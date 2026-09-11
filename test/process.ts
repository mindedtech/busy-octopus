/**
 * @file Run bounded child processes for package tests.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const MAXIMUM_PROCESS_OUTPUT_BYTE_COUNT = 1_048_576;

export const executeTestCommand = async ({
  argumentList,
  command,
  directory,
  environment,
  timeoutMilliseconds = 30_000,
}: {
  argumentList: string[];
  command: string;
  directory: string;
  environment?: NodeJS.ProcessEnv;
  timeoutMilliseconds?: number;
}): Promise<string> => {
  try {
    const { stdout } = await execFileAsync(command, argumentList, {
      cwd: directory,
      encoding: "utf8",
      ...(environment === undefined ? {} : { env: environment }),
      maxBuffer: MAXIMUM_PROCESS_OUTPUT_BYTE_COUNT,
      timeout: timeoutMilliseconds,
      windowsHide: true,
    });

    return stdout;
  } catch (error: unknown) {
    if (!(error instanceof Error)) {
      throw error;
    }

    const outputList = [
      "stdout" in error && typeof error.stdout === "string" ? error.stdout : "",
      "stderr" in error && typeof error.stderr === "string" ? error.stderr : "",
    ].filter((output) => output.length > 0);

    if (outputList.length === 0) {
      throw error;
    }

    throw new Error(`${error.message}\n${outputList.join("\n")}`, {
      cause: error,
    });
  }
};

export const executeNpm = ({
  argumentList,
  directory,
  environment,
}: {
  argumentList: string[];
  directory: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<string> =>
  process.platform === "win32"
    ? executeTestCommand({
        argumentList: ["/d", "/s", "/c", "npm", ...argumentList],
        command: process.env.ComSpec ?? "cmd.exe",
        directory,
        ...(environment === undefined ? {} : { environment }),
      })
    : executeTestCommand({
        argumentList,
        command: "npm",
        directory,
        ...(environment === undefined ? {} : { environment }),
      });
