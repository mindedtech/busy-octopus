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
  #clock: () => number;
  #disableTransition: boolean;
  #fileMap = new Map<
    string,
    { byteList: Uint8Array; modificationTime: number }
  >();
  #onList: ((maximumEntryCount: number) => void) | undefined;
  #readError: Error | null;

  constructor({
    clock = Date.now,
    disableTransition = false,
    onList,
    readError = null,
  }: {
    clock?: () => number;
    disableTransition?: boolean;
    onList?: (maximumEntryCount: number) => void;
    readError?: Error | null;
  } = {}) {
    this.#clock = clock;
    this.#disableTransition = disableTransition;
    this.#onList = onList;
    this.#readError = readError;
  }

  claim: QueuePublisherFileSystem["claim"] = async ({
    modificationTime,
    source,
    target,
  }) => {
    if (this.#disableTransition || this.#fileMap.has(target)) {
      return false;
    }

    const entry = this.#fileMap.get(source);
    if (entry === undefined) {
      return false;
    }
    this.#fileMap.set(target, { ...entry, modificationTime });
    this.#fileMap.delete(source);
    return true;
  };

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

    const entry = this.#fileMap.get(path);
    ok(entry !== undefined, "Queue file does not exist.");
    if (entry.byteList.byteLength > maximumByteCount) {
      throw new QueueFileTooLargeError(maximumByteCount);
    }
    return entry.byteList;
  };

  readModificationTime: QueuePublisherFileSystem["readModificationTime"] =
    async (path) => this.#fileMap.get(path)?.modificationTime ?? null;

  remove: QueuePublisherFileSystem["remove"] = async (path) => {
    this.#fileMap.delete(path);
  };

  placeExclusive: QueuePublisherFileSystem["placeExclusive"] = async (
    source,
    target,
  ) => {
    if (this.#disableTransition || this.#fileMap.has(target)) {
      return false;
    }

    const entry = this.#fileMap.get(source);
    if (entry === undefined) {
      return false;
    }
    this.#fileMap.set(target, entry);
    this.#fileMap.delete(source);
    return true;
  };

  writeExclusive: QueuePublisherFileSystem["writeExclusive"] = async (
    path,
    byteList,
  ) => {
    ok(!this.#fileMap.has(path), "Queue file already exists.");
    this.#fileMap.set(path, {
      byteList,
      modificationTime: this.#clock(),
    });
  };

  seed = (path: string, value: string | Uint8Array = ""): void => {
    this.#fileMap.set(path, {
      byteList: typeof value === "string" ? encoder.encode(value) : value,
      modificationTime: this.#clock(),
    });
  };

  nameList = (path: string): string[] =>
    [...this.#fileMap.keys()]
      .filter((filePath) => dirname(filePath) === path)
      .map((filePath) => basename(filePath));

  text = (path: string): string | null => {
    const entry = this.#fileMap.get(path);
    return entry === undefined
      ? null
      : new TextDecoder().decode(entry.byteList);
  };
}
