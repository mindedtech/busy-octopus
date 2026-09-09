/**
 * @file Verify command completion notifications.
 */

import { basename } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotifyInput, notify } from "../library/notify.js";
import { MAXIMUM_NOTIFICATION_BODY_CODE_POINT_COUNT } from "../protocol/notification.js";
import { runTestCli } from "./test.js";

const { publish } = vi.hoisted(() => ({
  publish: vi.fn<typeof notify>(),
}));

vi.mock("../library/notify.js", () => ({ notify: publish }));

type CliResult = Awaited<ReturnType<typeof runTestCli>>;
const commandOutput = [
  "HEAD",
  "SECOND",
  "x".repeat(MAXIMUM_NOTIFICATION_BODY_CODE_POINT_COUNT),
  "PENULTIMATE",
  "TAIL",
].join("\n");
const longLine = `HEAD${"x".repeat(MAXIMUM_NOTIFICATION_BODY_CODE_POINT_COUNT)}TAIL`;

beforeEach(() => {
  publish.mockReset();
  publish.mockResolvedValue({ notificationId: "synthetic-notification" });
});

describe("run", () => {
  it("shows help", async () => {
    const result = await runTestCli(["run", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(
      "Usage: busy-octopus run [options] <command> [argument...]",
    );
    expect(result.stdout).toContain("-s, --success-only");
    expect(result.stdout).toContain("-f, --failure-only");
    expect(result.stdout).toContain("-H, --head");
    expect(result.stdout).toContain("-T, --tail");
    expect(result.stdout).toContain("-h, --help");
  });

  it("notifies after success", async () => {
    await expect(
      runTestCli(["run", "--", process.execPath, "-e", "process.exit(0)"]),
    ).resolves.toEqual({
      exitCode: 0,
      stderr: "",
      stdout: "",
    } satisfies CliResult);
    expect(publish).toHaveBeenCalledWith({
      body: null,
      source: { kind: "command", name: basename(process.execPath) },
      title: "Succeeded.",
    } satisfies NotifyInput);
  });

  it("notifies after failure and preserves the exit code", async () => {
    await expect(
      runTestCli(["run", "--", process.execPath, "-e", "process.exit(7)"]),
    ).resolves.toEqual({
      exitCode: 7,
      stderr: "",
      stdout: "",
    } satisfies CliResult);
    expect(publish).toHaveBeenCalledWith({
      body: null,
      source: { kind: "command", name: basename(process.execPath) },
      title: "Failed with exit code 7.",
    } satisfies NotifyInput);
  });

  it.each([
    {
      argumentList: [
        "run",
        "-f",
        "--",
        process.execPath,
        "-e",
        "process.exit(0)",
      ],
      title: "Succeeded.",
    },
    {
      argumentList: [
        "run",
        "-s",
        "--",
        process.execPath,
        "-e",
        "process.exit(4)",
      ],
      title: "Failed with exit code 4.",
    },
  ] satisfies { argumentList: string[]; title: string }[])(
    "skips $title with restrictive options",
    async ({ argumentList }) => {
      await runTestCli(argumentList);

      expect(publish).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      body: "HEAD\nSECOND",
      flag: "-H",
      output: commandOutput,
    },
    {
      body: "TAIL\nPENULTIMATE",
      flag: "-T",
      output: commandOutput,
    },
    {
      body: longLine.slice(0, MAXIMUM_NOTIFICATION_BODY_CODE_POINT_COUNT),
      flag: "--head",
      output: longLine,
    },
    {
      body: longLine.slice(-MAXIMUM_NOTIFICATION_BODY_CODE_POINT_COUNT),
      flag: "--tail",
      output: longLine,
    },
  ] satisfies { body: string; flag: string; output: string }[])(
    "includes the output $flag selects",
    async ({ body, flag, output }) => {
      const stdoutWrite = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);

      try {
        await runTestCli([
          "run",
          flag,
          "--",
          process.execPath,
          "-e",
          "process.stdout.write(process.argv[1] ?? '')",
          output,
        ]);

        expect(publish).toHaveBeenCalledWith({
          body,
          source: { kind: "command", name: basename(process.execPath) },
          title: basename(process.execPath),
        } satisfies NotifyInput);
      } finally {
        stdoutWrite.mockRestore();
      }
    },
  );

  it("rejects conflicting output options", async () => {
    const result = await runTestCli([
      "run",
      "--head",
      "--tail",
      "--",
      process.execPath,
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).not.toBe("");
    expect(result.stdout).toBe("");
    expect(publish).not.toHaveBeenCalled();
  });

  it("passes options after the command without a separator", async () => {
    const result = await runTestCli([
      "run",
      process.execPath,
      "-e",
      'process.exit(process.argv[1] === "--synthetic" ? 0 : 9)',
      "--",
      "--synthetic",
    ]);

    expect(result.exitCode).toBe(0);
  });

  it("rejects conflicting notification options", async () => {
    const result = await runTestCli([
      "run",
      "--success-only",
      "--failure-only",
      "--",
      process.execPath,
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).not.toBe("");
    expect(result.stdout).toBe("");
    expect(publish).not.toHaveBeenCalled();
  });

  it("reports a command that cannot start", async () => {
    await expect(
      runTestCli([
        "run",
        "--",
        `${process.execPath}-synthetic-missing-command`,
      ]),
    ).resolves.toEqual({
      exitCode: 1,
      stderr: "busy-octopus: unable to start the command.\n",
      stdout: "",
    } satisfies CliResult);
    expect(publish).toHaveBeenCalledWith({
      body: null,
      source: {
        kind: "command",
        name: `${basename(process.execPath)}-synthetic-missing-command`,
      },
      title: "Could not start.",
    } satisfies NotifyInput);
  });

  it.runIf(process.platform !== "win32")(
    "preserves signal termination",
    async () => {
      const kill = vi.spyOn(process, "kill").mockReturnValue(true);

      try {
        await runTestCli([
          "run",
          "--",
          process.execPath,
          "-e",
          'process.kill(process.pid, "SIGTERM")',
        ]);

        expect(publish).toHaveBeenCalledWith({
          body: null,
          source: { kind: "command", name: basename(process.execPath) },
          title: "Stopped by SIGTERM.",
        } satisfies NotifyInput);
        expect(kill).toHaveBeenCalledWith(process.pid, "SIGTERM");
      } finally {
        kill.mockRestore();
      }
    },
  );

  it("keeps the command result when notification fails", async () => {
    publish.mockRejectedValue(new Error("Synthetic notification failure."));

    await expect(
      runTestCli(["run", "--", process.execPath, "-e", "process.exit(6)"]),
    ).resolves.toEqual({
      exitCode: 6,
      stderr: "",
      stdout: "",
    } satisfies CliResult);
  });
});
