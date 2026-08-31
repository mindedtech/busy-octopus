/**
 * @file Run the extension integration test in a VS Code UI host.
 */

import { spawn } from "node:child_process";
import { join } from "node:path";
import { cwd, env, execPath, platform } from "node:process";
import { fileURLToPath } from "node:url";

const runCommand = async ({
  argumentList,
  command,
  environment,
}: {
  argumentList: string[];
  command: string;
  environment: NodeJS.ProcessEnv;
}): Promise<void> => {
  const { promise, reject, resolve } = Promise.withResolvers<void>();
  const child = spawn(command, argumentList, {
    env: environment,
    stdio: "inherit",
  });

  child.once("error", reject);
  child.once("exit", (code, signal) => {
    if (code === 0) {
      resolve();
      return;
    }

    reject(
      new Error(
        `${command} exited with ${code === null ? `signal ${signal}` : `code ${code}`}.`,
      ),
    );
  });

  await promise;
};

const runInVirtualDisplay = async (): Promise<void> => {
  await runCommand({
    argumentList: [
      "--auto-servernum",
      execPath,
      "--experimental-strip-types",
      fileURLToPath(import.meta.url),
    ],
    command: "xvfb-run",
    environment: { ...env, BUSY_OCTOPUS_TEST_DISPLAY: "1" },
  });
};

const run = async (): Promise<void> => {
  if (
    platform === "linux" &&
    env.DISPLAY === undefined &&
    env.BUSY_OCTOPUS_TEST_DISPLAY !== "1"
  ) {
    await runInVirtualDisplay();
    return;
  }

  await runCommand({
    argumentList: [
      join(cwd(), "node_modules", "@vscode", "test-cli", "out", "bin.mjs"),
    ],
    command: execPath,
    environment: { ...env, ELECTRON_RUN_AS_NODE: undefined },
  });
};

await run();
