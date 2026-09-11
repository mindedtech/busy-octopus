/**
 * @file Create the versioned npm package archive.
 */

import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { relative } from "node:path";
import { promisify } from "node:util";
import {
  artifactDirectory,
  packageArchivePath,
  repositoryDirectory,
} from "./metadata.ts";

const execFileAsync = promisify(execFile);
// Keep checkout paths out of cmd.exe's command string.
const argumentList = [
  "pack",
  "--out",
  relative(repositoryDirectory, packageArchivePath),
];
const packProcess =
  process.platform === "win32"
    ? {
        command: process.env.ComSpec ?? "cmd.exe",
        argumentList: ["/d", "/s", "/c", "pnpm", ...argumentList],
      }
    : { command: "pnpm", argumentList };

await mkdir(artifactDirectory, { recursive: true });
await rm(packageArchivePath, { force: true });
await execFileAsync(packProcess.command, packProcess.argumentList, {
  maxBuffer: 1_048_576,
  timeout: 30_000,
  windowsHide: true,
});
