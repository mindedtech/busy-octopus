/**
 * @file Create the versioned npm package archive.
 */

import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { z } from "zod";
import { artifactDirectory, packageArchivePath } from "./metadata.ts";

const execFileAsync = promisify(execFile);
const packageManagerPath = z.string().min(1).parse(process.env.npm_execpath);

await mkdir(artifactDirectory, { recursive: true });
await rm(packageArchivePath, { force: true });
await execFileAsync(
  process.execPath,
  [packageManagerPath, "pack", "--out", packageArchivePath],
  {
    maxBuffer: 1_048_576,
    timeout: 30_000,
    windowsHide: true,
  },
);
