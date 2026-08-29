/**
 * @file Define bounded filesystem operations for notification queues.
 */

/**
 * Report queue input that exceeds its byte boundary.
 */
export class QueueFileTooLargeError extends Error {
  constructor(maximumByteCount: number) {
    super(`Queue file exceeds ${maximumByteCount} bytes.`);
    this.name = "QueueFileTooLargeError";
  }
}

/**
 * Provide bounded storage operations with atomic ownership transitions.
 */
export type QueueFileSystem<Resource = string> = {
  /**
   * Acquire a pending file at its sole processing target without replacement.
   *
   * @returns Whether the target acquired stable ownership of the source contents.
   */
  claim: ({
    modificationTime,
    source,
    target,
  }: {
    modificationTime: number;
    source: Resource;
    target: Resource;
  }) => Promise<boolean>;
  createDirectory: (resource: Resource) => Promise<void>;
  join: (directory: Resource, name: string) => Resource;
  /**
   * List no more than the requested number of direct child names.
   */
  list: (resource: Resource, maximumEntryCount: number) => Promise<string[]>;
  /**
   * Read no more than the requested number of bytes.
   *
   * @throws {QueueFileTooLargeError} If the file exceeds the byte boundary.
   */
  read: (resource: Resource, maximumByteCount: number) => Promise<Uint8Array>;
  /**
   * Read the resource modification time as Unix epoch milliseconds.
   *
   * @returns Modification time, or null when the resource does not exist.
   */
  readModificationTime: (resource: Resource) => Promise<number | null>;
  remove: (resource: Resource) => Promise<void>;
  /**
   * Make complete source contents atomically available at a target that does not exist.
   *
   * @returns Whether the target received the source contents.
   */
  placeExclusive: (source: Resource, target: Resource) => Promise<boolean>;
};

/**
 * Extend queue storage with exclusive file creation for publication.
 */
export type QueuePublisherFileSystem<Resource = string> =
  QueueFileSystem<Resource> & {
    /**
     * Create a new file without replacing an existing resource.
     */
    writeExclusive: (resource: Resource, byteList: Uint8Array) => Promise<void>;
  };
