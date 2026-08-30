/**
 * @file Instrument the command-line interface for behavioral tests.
 */

import type { OutputConfiguration } from "@commander-js/extra-typings";
import { vi } from "vitest";

export const runTestCli = async (
  argumentList: string[],
): Promise<{ exitCode: number; stderr: string; stdout: string }> => {
  vi.resetModules();
  const stdoutChunkList: string[] = [];
  const stderrChunkList: string[] = [];
  let exitCode = 0;
  const consoleLog = vi
    .spyOn(console, "log")
    .mockImplementation((...valueList: unknown[]) => {
      stdoutChunkList.push(`${valueList.join(" ")}\n`);
    });

  try {
    const [{ CommanderError }, { program }] = await Promise.all([
      import("@commander-js/extra-typings"),
      import("./cli.js"),
    ]);
    const output: OutputConfiguration = {
      ...program.configureOutput(),
      writeErr: (chunk) => {
        stderrChunkList.push(chunk);
      },
      writeOut: (chunk) => {
        stdoutChunkList.push(chunk);
      },
    };
    for (const command of [program, ...program.commands]) {
      command.configureOutput(output).exitOverride();
    }

    try {
      await program.parseAsync(argumentList, { from: "user" });
    } catch (error: unknown) {
      if (!(error instanceof CommanderError)) {
        throw error;
      }
      exitCode = error.exitCode;
    }

    return {
      exitCode,
      stderr: stderrChunkList.join(""),
      stdout: stdoutChunkList.join(""),
    };
  } finally {
    consoleLog.mockRestore();
  }
};
