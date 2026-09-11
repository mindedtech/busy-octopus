/**
 * @file Write SHA-256 checksums for release archives.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  checksumPath,
  extensionArchivePath,
  packageArchivePath,
} from "./metadata.ts";

const archivePathList = [packageArchivePath, extensionArchivePath].toSorted();
const checksumLineList = await Promise.all(
  archivePathList.map(async (path) => {
    const checksum = createHash("sha256")
      .update(await readFile(path))
      .digest("hex");

    return `${checksum}  ${basename(path)}`;
  }),
);

await writeFile(checksumPath, `${checksumLineList.join("\n")}\n`);
