/**
 * @file Adapt native Node.js filesystem operations to notification queues.
 */

import { ok } from "node:assert/strict";
import type { Stats } from "node:fs";
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  opendir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import {
  QueueFileTooLargeError,
  type QueuePublisherFileSystem,
} from "./file-system.js";

const fileMissing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

export const nativeQueueFileSystem: QueuePublisherFileSystem = {
  createDirectory: async (path) => {
    await mkdir(path, { mode: 0o700, recursive: true });
    await chmod(path, 0o700);
  },
  join,
  list: async (path, maximumEntryCount) => {
    ok(
      Number.isSafeInteger(maximumEntryCount) && maximumEntryCount >= 0,
      "Maximum queue entry count must be a nonnegative safe integer.",
    );
    if (maximumEntryCount === 0) {
      return [];
    }

    const entryNameList: string[] = [];
    for await (const entry of await opendir(path)) {
      entryNameList.push(entry.name);
      if (entryNameList.length >= maximumEntryCount) {
        break;
      }
    }
    return entryNameList;
  },
  read: async (path, maximumByteCount) => {
    ok(
      Number.isSafeInteger(maximumByteCount) && maximumByteCount >= 0,
      "Maximum queue byte count must be a nonnegative safe integer.",
    );
    const file = await open(path, "r");
    try {
      const byteList = new Uint8Array(maximumByteCount + 1);
      const { bytesRead } = await file.read(
        byteList,
        0,
        byteList.byteLength,
        0,
      );
      if (bytesRead > maximumByteCount) {
        throw new QueueFileTooLargeError(maximumByteCount);
      }
      return byteList.subarray(0, bytesRead);
    } finally {
      await file.close();
    }
  },
  remove: async (path) => {
    let status: Stats;
    try {
      status = await lstat(path);
    } catch (error: unknown) {
      if (fileMissing(error)) {
        return;
      }
      throw error;
    }
    if (status.isDirectory()) {
      return;
    }
    await rm(path, { force: true });
  },
  rename: async (source, target) => {
    try {
      await rename(source, target);
      return true;
    } catch (error: unknown) {
      if (fileMissing(error)) {
        return false;
      }
      throw error;
    }
  },
  placeExclusive: async (source, target) => {
    try {
      await link(source, target);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error.code === "ENOENT" || error.code === "EEXIST")
      ) {
        return false;
      }
      throw error;
    }
    await rm(source, { force: true }).catch(() => undefined);
    return true;
  },
  writeExclusive: async (path, byteList) => {
    await writeFile(path, byteList, { flag: "wx", mode: 0o600 });
  },
};
