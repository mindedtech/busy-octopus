/**
 * @file Run the VS Code CLI without interpreting test paths as shell commands.
 */

import { ok } from "node:assert/strict";
import { dirname, join } from "node:path";
import { resolveCliArgsFromVSCodeExecutablePath } from "@vscode/test-electron";
import { executeTestCommand } from "./process.js";

export const executeVsCodeCli = ({
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
    // Mirror code.cmd through Electron directly, preserving every argument literally.
    return executeTestCommand({
      argumentList: [
        join(dirname(executablePath), "resources", "app", "out", "cli.js"),
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
