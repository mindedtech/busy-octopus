/**
 * @file Run the VS Code CLI without interpreting test paths as shell commands.
 */

import { ok } from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolveCliArgsFromVSCodeExecutablePath } from "@vscode/test-electron";
import { executeTestCommand } from "./process.js";

const resolveWindowsCliPath = async (
  executablePath: string,
): Promise<string> => {
  const applicationDirectory = dirname(executablePath);
  const versionEntry = (
    await readdir(applicationDirectory, {
      withFileTypes: true,
    })
  ).find((entry) => entry.isDirectory() && /^[0-9a-f]{10}$/u.test(entry.name));

  return join(
    applicationDirectory,
    versionEntry?.name ?? "",
    "resources",
    "app",
    "out",
    "cli.js",
  );
};

export const executeVsCodeCli = async ({
  argumentList,
  executablePath,
  directory,
  environment,
  platform = process.platform,
}: {
  argumentList: string[];
  executablePath: string;
  directory: string;
  environment: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}): Promise<string> => {
  if (platform === "win32") {
    // Mirror code.cmd without a command shell, preserving every argument literally.
    return executeTestCommand({
      argumentList: [
        await resolveWindowsCliPath(executablePath),
        ...argumentList,
      ],
      command: executablePath,
      directory,
      environment: {
        ...environment,
        ELECTRON_RUN_AS_NODE: "1",
        VSCODE_DEV: undefined,
      },
    });
  }

  const [command, ...cliArgumentList] = resolveCliArgsFromVSCodeExecutablePath(
    executablePath,
    {
      reuseMachineInstall: true,
    },
  );
  ok(command, "VS Code CLI path is unavailable.");

  return executeTestCommand({
    argumentList: [...cliArgumentList, ...argumentList],
    command,
    directory,
    environment,
  });
};
