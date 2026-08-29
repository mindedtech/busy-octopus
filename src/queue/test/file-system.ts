/**
 * @file Provide deterministic in-memory queue storage for tests.
 */

import { ok } from "node:assert/strict";
import { basename, dirname, posix } from "node:path";
import {
  QueueFileTooLargeError,
  type QueuePublisherFileSystem,
} from "../file-system.js";

const encoder = new TextEncoder();

export class MemoryQueueFileSystem implements QueuePublisherFileSystem {
  #disableRename: boolean;
  #fileMap = new Map<string, Uint8Array>();
  #onList: ((maximumEntryCount: number) => void) | undefined;
  #readError: Error | null;

  constructor({
    disableRename = false,
    onList,
    readError = null,
  }: {
    disableRename?: boolean;
    onList?: (maximumEntryCount: number) => void;
    readError?: Error | null;
  } = {}) {
    this.#disableRename = disableRename;
    this.#onList = onList;
    this.#readError = readError;
  }

  createDirectory: QueuePublisherFileSystem["createDirectory"] = async (
    _path,
  ) => {};

  join: QueuePublisherFileSystem["join"] = posix.join;

  list: QueuePublisherFileSystem["list"] = async (path, maximumEntryCount) => {
    this.#onList?.(maximumEntryCount);
    return [...this.#fileMap.keys()]
      .filter((filePath) => dirname(filePath) === path)
      .map((filePath) => basename(filePath))
      .slice(0, maximumEntryCount);
  };

  read: QueuePublisherFileSystem["read"] = async (path, maximumByteCount) => {
    if (this.#readError !== null) {
      throw this.#readError;
    }

    const byteList = this.#fileMap.get(path);
    ok(byteList !== undefined, "Queue file does not exist.");
    if (byteList.byteLength > maximumByteCount) {
      throw new QueueFileTooLargeError(maximumByteCount);
    }
    return byteList;
  };

  remove: QueuePublisherFileSystem["remove"] = async (path) => {
    this.#fileMap.delete(path);
  };

  rename: QueuePublisherFileSystem["rename"] = async (source, target) => {
    if (this.#disableRename) {
      return false;
    }

    const byteList = this.#fileMap.get(source);
    if (byteList === undefined) {
      return false;
    }
    this.#fileMap.delete(source);
    this.#fileMap.set(target, byteList);
    return true;
  };

  placeExclusive: QueuePublisherFileSystem["placeExclusive"] = async (
    source,
    target,
  ) => {
    if (this.#disableRename || this.#fileMap.has(target)) {
      return false;
    }

    return this.rename(source, target);
  };

  writeExclusive: QueuePublisherFileSystem["writeExclusive"] = async (
    path,
    byteList,
  ) => {
    ok(!this.#fileMap.has(path), "Queue file already exists.");
    this.#fileMap.set(path, byteList);
  };

  seed = (path: string, value: string | Uint8Array = ""): void => {
    this.#fileMap.set(
      path,
      typeof value === "string" ? encoder.encode(value) : value,
    );
  };

  nameList = (path: string): string[] =>
    [...this.#fileMap.keys()]
      .filter((filePath) => dirname(filePath) === path)
      .map((filePath) => basename(filePath));

  text = (path: string): string | null => {
    const byteList = this.#fileMap.get(path);
    return byteList === undefined ? null : new TextDecoder().decode(byteList);
  };
}
