/**
 * @file Provide native operations for workspace resolution.
 */

import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import type { WorkspacePlatform } from "./identity.js";

const MAXIMUM_GIT_OUTPUT_BYTE_COUNT = 4_096;
const GIT_TIMEOUT_MILLISECOND_COUNT = 1_000;

/**
 * Supply operations whose results vary across workspace runtimes.
 */
export type WorkspaceRuntime = {
  canonicalize: (path: string) => Promise<string>;
  currentDirectory: () => string;
  git: ({
    argumentList,
    directory,
  }: {
    argumentList: string[];
    directory: string;
  }) => Promise<string | null>;
  platform: WorkspacePlatform;
};

const runGit = ({
  argumentList,
  directory,
}: {
  argumentList: string[];
  directory: string;
}): Promise<string | null> =>
  new Promise((resolve) => {
    execFile(
      "git",
      ["-C", directory, ...argumentList],
      {
        encoding: "utf8",
        maxBuffer: MAXIMUM_GIT_OUTPUT_BYTE_COUNT,
        timeout: GIT_TIMEOUT_MILLISECOND_COUNT,
        windowsHide: true,
      },
      (error, output) => {
        if (error !== null) {
          resolve(null);
          return;
        }

        const result = output.replace(/\r?\n$/u, "");
        resolve(result.length > 0 ? result : null);
      },
    );
  });

export const nativeWorkspaceRuntime: WorkspaceRuntime = {
  canonicalize: realpath,
  currentDirectory: () => process.cwd(),
  git: runGit,
  platform: process.platform === "win32" ? "win32" : "posix",
};
