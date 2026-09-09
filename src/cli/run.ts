/**
 * @file Run a command and notify when it exits.
 */

import { ok } from "node:assert/strict";
import { spawn } from "node:child_process";
import { basename } from "node:path";
import { Command, Option } from "@commander-js/extra-typings";
import { notify } from "../library/notify.js";
import { MAXIMUM_NOTIFICATION_BODY_CODE_POINT_COUNT } from "../protocol/notification.js";

const signalList = ["SIGINT", "SIGTERM", "SIGHUP"] satisfies NodeJS.Signals[];

type OutputCapture = "head" | "tail";

type CommandResult = ({ exitCode: number } | { signal: NodeJS.Signals }) & {
  output: string | null;
};

const appendOutput = ({
  capture,
  output,
  value,
}: {
  capture: OutputCapture;
  output: string;
  value: string;
}): string => {
  const codePointList = Array.from(`${output}${value}`);

  switch (capture) {
    case "head":
      return codePointList
        .slice(0, MAXIMUM_NOTIFICATION_BODY_CODE_POINT_COUNT + 1)
        .join("");
    case "tail":
      return codePointList
        .slice(-(MAXIMUM_NOTIFICATION_BODY_CODE_POINT_COUNT + 1))
        .join("");
  }
};

const selectOutput = ({
  capture,
  output,
}: {
  capture: OutputCapture;
  output: string;
}): string | null => {
  const codePointList = Array.from(output);
  let value = output;

  if (codePointList.length > MAXIMUM_NOTIFICATION_BODY_CODE_POINT_COUNT) {
    switch (capture) {
      case "head": {
        value = codePointList
          .slice(0, MAXIMUM_NOTIFICATION_BODY_CODE_POINT_COUNT)
          .join("");

        if (
          !["\n", "\r"].includes(
            codePointList[MAXIMUM_NOTIFICATION_BODY_CODE_POINT_COUNT] ?? "",
          )
        ) {
          const lineBreak = value.lastIndexOf("\n");

          if (lineBreak > 0) {
            value = value.slice(0, lineBreak);
          }
        }
        break;
      }
      case "tail": {
        value = codePointList
          .slice(-MAXIMUM_NOTIFICATION_BODY_CODE_POINT_COUNT)
          .join("");
        const boundary =
          codePointList.at(-(MAXIMUM_NOTIFICATION_BODY_CODE_POINT_COUNT + 1)) ??
          "";

        if (boundary !== "\n") {
          const lineBreak = value.indexOf("\n");
          const suffix = lineBreak < 0 ? "" : value.slice(lineBreak + 1);

          if (suffix.trim().length > 0) {
            value = suffix;
          }
        }
        break;
      }
    }
  }

  const lineList = value.trim().split(/\r?\n/u);

  if (lineList.length === 1 && lineList[0] === "") {
    return null;
  }

  return (capture === "head" ? lineList : lineList.toReversed()).join("\n");
};

const execute = async ({
  argumentList,
  capture,
  command,
}: {
  argumentList: string[];
  capture: OutputCapture | null;
  command: string;
}): Promise<CommandResult> => {
  const child = spawn(command, argumentList, {
    stdio: capture === null ? "inherit" : ["inherit", "pipe", "pipe"],
    windowsHide: true,
  });
  const { promise, reject, resolve } = Promise.withResolvers<CommandResult>();
  let output = "";
  const signalListenerList = signalList.map((signal) => {
    const listener = (): void => {
      child.kill(signal);
    };

    process.on(signal, listener);

    return { listener, signal };
  });

  if (capture !== null) {
    ok(child.stdout !== null);
    ok(child.stderr !== null);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.pipe(process.stdout, { end: false });
    child.stderr.pipe(process.stderr, { end: false });
    child.stdout.on("data", (value: string) => {
      output = appendOutput({ capture, output, value });
    });
    child.stderr.on("data", (value: string) => {
      output = appendOutput({ capture, output, value });
    });
  }

  child.once("error", reject);
  child.once("close", (exitCode, signal) => {
    const notificationOutput =
      capture === null ? null : selectOutput({ capture, output });

    if (exitCode !== null) {
      resolve({ exitCode, output: notificationOutput });
      return;
    }

    if (signal !== null) {
      resolve({ output: notificationOutput, signal });
      return;
    }

    ok(false, "Child process exited without a code or signal.");
  });

  try {
    return await promise;
  } finally {
    for (const { listener, signal } of signalListenerList) {
      process.off(signal, listener);
    }
  }
};

const publishResult = async ({
  body,
  command,
  title,
}: {
  body: string | null;
  command: string;
  title: string | null;
}): Promise<void> => {
  try {
    const sourceName = Array.from(basename(command)).slice(0, 120).join("");

    await notify({
      body,
      source: {
        kind: "command",
        name: sourceName,
      },
      title: title ?? sourceName,
    });
  } catch {
    // Notification failure must not change the command result.
  }
};

export const runCommand = new Command("run")
  .description("Run a command and notify when it exits.")
  .argument("<command>", "Command to run.")
  .argument("[argument...]", "Arguments passed to the command.")
  .addOption(
    new Option(
      "-s, --success-only",
      "Notify only when the command succeeds.",
    ).conflicts("failureOnly"),
  )
  .addOption(
    new Option(
      "-f, --failure-only",
      "Notify only when the command fails.",
    ).conflicts("successOnly"),
  )
  .addOption(
    new Option(
      "-H, --head",
      "Include the start of the command output.",
    ).conflicts("tail"),
  )
  .addOption(
    new Option(
      "-T, --tail",
      "Include the end of the command output.",
    ).conflicts("head"),
  )
  .passThroughOptions()
  .action(
    async (
      command,
      argumentList,
      { failureOnly, head, successOnly, tail },
      context,
    ) => {
      let result: CommandResult;

      try {
        result = await execute({
          argumentList,
          capture: head ? "head" : tail ? "tail" : null,
          command,
        });
      } catch {
        if (!successOnly) {
          await publishResult({
            body: null,
            command,
            title: "Could not start.",
          });
        }

        context.error("busy-octopus: unable to start the command.", {
          code: "busy-octopus.run",
          exitCode: 1,
        });
        return;
      }

      if ("exitCode" in result) {
        if (
          (!failureOnly && result.exitCode === 0) ||
          (!successOnly && result.exitCode !== 0)
        ) {
          let title: string | null = null;

          if (result.exitCode === 0 && result.output === null) {
            title = "Succeeded.";
          }

          if (result.exitCode !== 0) {
            title = `Failed with exit code ${result.exitCode}.`;
          }

          await publishResult({
            body: result.output,
            command,
            title,
          });
        }

        process.exitCode = result.exitCode;
        return;
      }

      const signal = result.signal;
      if (!successOnly) {
        await publishResult({
          body: result.output,
          command,
          title: `Stopped by ${signal}.`,
        });
      }

      // Preserve signal termination instead of replacing it with an exit code.
      process.kill(process.pid, signal);
    },
  );
