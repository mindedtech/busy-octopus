/**
 * @file Adapt VS Code workspace filesystem operations to notification queues.
 */

import { ok } from "node:assert/strict";
import { type FileStat, FileType } from "vscode";
import { MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT } from "../../protocol/notification.js";
import {
  type QueueFileSystem,
  QueueFileTooLargeError,
} from "../../queue/file-system.js";

type WorkspaceFileStatus = Pick<FileStat, "mtime" | "size" | "type">;

export type WorkspaceFileSystem<Resource> = {
  createDirectory: (resource: Resource) => PromiseLike<void>;
  delete: (
    resource: Resource,
    options: { recursive: boolean; useTrash: boolean },
  ) => PromiseLike<void>;
  readDirectory: (resource: Resource) => PromiseLike<[string, number][]>;
  readFile: (resource: Resource) => PromiseLike<Uint8Array>;
  rename: (
    source: Resource,
    target: Resource,
    options: { overwrite: boolean },
  ) => PromiseLike<void>;
  stat: (resource: Resource) => PromiseLike<WorkspaceFileStatus>;
  writeFile: (resource: Resource, byteList: Uint8Array) => PromiseLike<void>;
};

const hasCode = (error: unknown, codeSet: Set<string>): boolean =>
  error instanceof Error &&
  "code" in error &&
  typeof error.code === "string" &&
  codeSet.has(error.code);

const missingCodeSet = new Set(["FileNotFound", "ENOENT"]);
const ownershipRaceCodeSet = new Set([
  "FileExists",
  "FileNotFound",
  "EEXIST",
  "ENOENT",
]);

/**
 * Provide bounded queue operations through the VS Code filesystem API.
 */
export class WorkspaceQueueFileSystem<Resource>
  implements QueueFileSystem<Resource>
{
  #fileSystem: WorkspaceFileSystem<Resource>;

  join: QueueFileSystem<Resource>["join"];

  constructor({
    fileSystem,
    join,
  }: {
    fileSystem: WorkspaceFileSystem<Resource>;
    join: QueueFileSystem<Resource>["join"];
  }) {
    this.#fileSystem = fileSystem;
    this.join = join;
  }

  claim: QueueFileSystem<Resource>["claim"] = async ({ source, target }) => {
    if (!(await this.placeExclusive(source, target))) {
      return false;
    }

    const { size } = await this.#fileSystem.stat(target);
    if (size <= MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT) {
      const byteList = await this.#fileSystem.readFile(target);
      if (byteList.byteLength <= MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT) {
        await this.#fileSystem.writeFile(target, byteList);
      }
    }

    return true;
  };

  createDirectory: QueueFileSystem<Resource>["createDirectory"] = async (
    resource,
  ) => this.#fileSystem.createDirectory(resource);

  list: QueueFileSystem<Resource>["list"] = async (
    resource,
    maximumEntryCount,
  ) => {
    this.#assertLimit(maximumEntryCount, "entry");

    if (maximumEntryCount === 0) {
      return [];
    }

    return (await this.#fileSystem.readDirectory(resource))
      .slice(0, maximumEntryCount)
      .map(([name]) => name);
  };

  read: QueueFileSystem<Resource>["read"] = async (
    resource,
    maximumByteCount,
  ) => {
    this.#assertLimit(maximumByteCount, "byte");

    if ((await this.#fileSystem.stat(resource)).size > maximumByteCount) {
      throw new QueueFileTooLargeError(maximumByteCount);
    }

    const byteList = await this.#fileSystem.readFile(resource);

    if (byteList.byteLength > maximumByteCount) {
      throw new QueueFileTooLargeError(maximumByteCount);
    }

    return byteList;
  };

  readModificationTime: QueueFileSystem<Resource>["readModificationTime"] =
    async (resource) =>
      (await this.#allowMissingResource(() => this.#fileSystem.stat(resource)))
        ?.mtime ?? null;

  remove: QueueFileSystem<Resource>["remove"] = async (resource) => {
    const status = await this.#allowMissingResource(() =>
      this.#fileSystem.stat(resource),
    );
    if (status === null || (status.type & FileType.Directory) !== 0) {
      return;
    }

    await this.#allowMissingResource(() =>
      this.#fileSystem.delete(resource, {
        recursive: false,
        useTrash: false,
      }),
    );
  };

  placeExclusive: QueueFileSystem<Resource>["placeExclusive"] = async (
    source,
    target,
  ) => {
    try {
      await this.#fileSystem.rename(source, target, { overwrite: false });

      return true;
    } catch (error: unknown) {
      if (hasCode(error, ownershipRaceCodeSet)) {
        return false;
      }

      throw error;
    }
  };

  #allowMissingResource = async <Result>(
    run: () => PromiseLike<Result>,
  ): Promise<Result | null> => {
    try {
      return await run();
    } catch (error: unknown) {
      if (hasCode(error, missingCodeSet)) {
        return null;
      }

      throw error;
    }
  };

  #assertLimit = (limit: number, unit: "byte" | "entry"): void => {
    ok(
      Number.isSafeInteger(limit) && limit >= 0,
      `Maximum queue ${unit} count must be a nonnegative safe integer.`,
    );
  };
}
