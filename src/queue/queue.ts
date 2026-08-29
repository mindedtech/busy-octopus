/**
 * @file Coordinate bounded notification publication and consumption.
 */

import { ok } from "node:assert/strict";
import {
  MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT,
  type NotificationRequest,
  NotificationRequestJson,
} from "../protocol/notification.js";
import {
  type QueueFileSystem,
  QueueFileTooLargeError,
  type QueuePublisherFileSystem,
} from "./file-system.js";

/**
 * Bound queue storage, recovery, and cleanup work.
 */
export const queuePolicy = {
  claimLifetimeMilliseconds: 5 * 60_000,
  cleanupCandidateCount: 64,
  entryCount: 256,
  requestLifetimeMilliseconds: 24 * 60 * 60_000,
};

/**
 * Own one request until delivery completes or returns it to the queue.
 */
export type QueueClaim = {
  abandon: () => Promise<void>;
  complete: () => Promise<void>;
  request: NotificationRequest;
};

const PENDING_NAME_PATTERN = /^(?<token>[a-f0-9]{32})\.json$/u;
const PROCESSING_NAME_PATTERN =
  /^(?<token>[a-f0-9]{32})\.processing\.(?:[A-Za-z0-9_-]{1,64})\.(?<timestamp>\d{1,16})$/u;
const TEMPORARY_NAME_PATTERN =
  /^\.publish\.(?:[a-f0-9]{32})\.(?<timestamp>\d{1,16})\.tmp$/u;
const CONSUMER_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;
const TOKEN_PATTERN = /^[a-f0-9]{32}$/u;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const parseTimestamp = (value: string | null): number | null => {
  if (value === null) {
    return null;
  }

  const timestamp = Number(value);
  return Number.isSafeInteger(timestamp) ? timestamp : null;
};

const exceedsLifetime = ({
  lifetimeMilliseconds,
  now,
  timestamp,
}: {
  lifetimeMilliseconds: number;
  now: number;
  timestamp: number;
}): boolean => now - timestamp > lifetimeMilliseconds;

const cleanupPriority = ({
  name,
  now,
}: {
  name: string;
  now: number;
}): number => {
  const match =
    PROCESSING_NAME_PATTERN.exec(name) ?? TEMPORARY_NAME_PATTERN.exec(name);
  if (match !== null) {
    const timestamp = parseTimestamp(match.groups?.timestamp ?? null);
    if (
      timestamp === null ||
      exceedsLifetime({
        lifetimeMilliseconds: queuePolicy.claimLifetimeMilliseconds,
        now,
        timestamp,
      })
    ) {
      return 0;
    }
    return 1;
  }

  return PENDING_NAME_PATTERN.test(name) ? 2 : 0;
};

const readTime = (clock: () => number): number => {
  const now = clock();
  ok(
    Number.isSafeInteger(now) && now >= 0,
    "Queue clock must return a nonnegative safe integer.",
  );
  return now;
};

const cleanup = async <Resource>({
  clock,
  directory,
  fileSystem,
}: {
  clock: () => number;
  directory: Resource;
  fileSystem: QueueFileSystem<Resource>;
}): Promise<void> => {
  await fileSystem.createDirectory(directory);
  const now = readTime(clock);
  const nameList = await fileSystem.list(
    directory,
    queuePolicy.entryCount + queuePolicy.cleanupCandidateCount,
  );

  for (const name of nameList
    .toSorted(
      (first, second) =>
        cleanupPriority({ name: first, now }) -
          cleanupPriority({ name: second, now }) || first.localeCompare(second),
    )
    .slice(0, queuePolicy.cleanupCandidateCount)) {
    const path = fileSystem.join(directory, name);
    const processingMatch = PROCESSING_NAME_PATTERN.exec(name);
    if (processingMatch !== null) {
      const token = processingMatch.groups?.token ?? null;
      const timestamp = parseTimestamp(
        processingMatch.groups?.timestamp ?? null,
      );
      if (token === null || timestamp === null) {
        await fileSystem.remove(path);
        continue;
      }
      if (
        exceedsLifetime({
          lifetimeMilliseconds: queuePolicy.claimLifetimeMilliseconds,
          now,
          timestamp,
        })
      ) {
        const pendingName = `${token}.json`;
        if (
          !(await fileSystem.placeExclusive(
            path,
            fileSystem.join(directory, pendingName),
          ))
        ) {
          await fileSystem.remove(path);
        }
      }
      continue;
    }

    const temporaryMatch = TEMPORARY_NAME_PATTERN.exec(name);
    if (temporaryMatch !== null) {
      const timestamp = parseTimestamp(
        temporaryMatch.groups?.timestamp ?? null,
      );
      if (
        timestamp === null ||
        exceedsLifetime({
          lifetimeMilliseconds: queuePolicy.claimLifetimeMilliseconds,
          now,
          timestamp,
        })
      ) {
        await fileSystem.remove(path);
      }
      continue;
    }

    if (PENDING_NAME_PATTERN.test(name)) {
      continue;
    }

    await fileSystem.remove(path);
  }
};

/**
 * Publish notifications through atomic queue transitions.
 */
export class NotificationQueuePublisher<Resource = string> {
  #clock: () => number;
  #createToken: () => string;
  #directory: Resource;
  #fileSystem: QueuePublisherFileSystem<Resource>;

  constructor({
    clock = Date.now,
    createToken,
    directory,
    fileSystem,
  }: {
    clock?: () => number;
    createToken: () => string;
    directory: Resource;
    fileSystem: QueuePublisherFileSystem<Resource>;
  }) {
    this.#clock = clock;
    this.#createToken = createToken;
    this.#directory = directory;
    this.#fileSystem = fileSystem;
  }

  /**
   * Publish one request through exclusive creation and placement.
   *
   * @throws {unknown} If validation or queue publication fails.
   */
  publish = async (request: NotificationRequest): Promise<void> => {
    const byteList = encoder.encode(NotificationRequestJson.encode(request));
    await cleanup({
      clock: this.#clock,
      directory: this.#directory,
      fileSystem: this.#fileSystem,
    });

    ok(
      (await this.#fileSystem.list(this.#directory, queuePolicy.entryCount))
        .length < queuePolicy.entryCount,
      "Notification queue is full.",
    );

    const token = this.#createToken().replaceAll("-", "").toLowerCase();
    ok(
      TOKEN_PATTERN.test(token),
      "Queue token must contain 32 hexadecimal characters.",
    );
    const now = readTime(this.#clock);
    const pendingName = `${token}.json`;
    const temporaryPath = this.#fileSystem.join(
      this.#directory,
      `.publish.${token}.${now}.tmp`,
    );
    const pendingPath = this.#fileSystem.join(this.#directory, pendingName);

    await this.#fileSystem.writeExclusive(temporaryPath, byteList);
    try {
      if (
        !(await this.#fileSystem.placeExclusive(temporaryPath, pendingPath))
      ) {
        ok(
          !(
            await this.#fileSystem.list(this.#directory, queuePolicy.entryCount)
          ).includes(pendingName),
          "Queue token already exists.",
        );
        ok(false, "Temporary queue request disappeared before publication.");
      }
    } catch (error: unknown) {
      await this.#fileSystem.remove(temporaryPath).catch(() => undefined);
      throw error;
    }
  };
}

/**
 * Claim notifications through atomic queue ownership.
 */
export class NotificationQueue<Resource = string> {
  #clock: () => number;
  #directory: Resource;
  #fileSystem: QueueFileSystem<Resource>;

  constructor({
    clock = Date.now,
    directory,
    fileSystem,
  }: {
    clock?: () => number;
    directory: Resource;
    fileSystem: QueueFileSystem<Resource>;
  }) {
    this.#clock = clock;
    this.#directory = directory;
    this.#fileSystem = fileSystem;
  }

  /**
   * Claim the next valid request through an atomic ownership transition.
   *
   * @returns Claimed request, or null when no valid request is pending.
   * @throws {unknown} If validation or queue access fails unexpectedly.
   */
  claim = async (consumerId: string): Promise<QueueClaim | null> => {
    ok(
      CONSUMER_IDENTIFIER_PATTERN.test(consumerId),
      "Queue consumer identifier is invalid.",
    );
    await cleanup({
      clock: this.#clock,
      directory: this.#directory,
      fileSystem: this.#fileSystem,
    });

    for (const name of (
      await this.#fileSystem.list(this.#directory, queuePolicy.entryCount)
    ).toSorted()) {
      const match = PENDING_NAME_PATTERN.exec(name);
      if (match === null) {
        continue;
      }

      const token = match.groups?.token ?? null;
      if (token === null) {
        continue;
      }

      const pendingPath = this.#fileSystem.join(this.#directory, name);
      const processingPath = this.#fileSystem.join(
        this.#directory,
        `${token}.processing.${consumerId}.${readTime(this.#clock)}`,
      );
      if (!(await this.#fileSystem.rename(pendingPath, processingPath))) {
        continue;
      }

      let byteList: Uint8Array;
      try {
        byteList = await this.#fileSystem.read(
          processingPath,
          MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT,
        );
      } catch (error: unknown) {
        if (!(error instanceof QueueFileTooLargeError)) {
          throw error;
        }
        await this.#fileSystem.remove(processingPath);
        continue;
      }

      let request: NotificationRequest;
      try {
        request = NotificationRequestJson.decode(decoder.decode(byteList));
      } catch {
        await this.#fileSystem.remove(processingPath);
        continue;
      }

      if (
        exceedsLifetime({
          lifetimeMilliseconds: queuePolicy.requestLifetimeMilliseconds,
          now: readTime(this.#clock),
          timestamp: Date.parse(request.creationTime),
        })
      ) {
        await this.#fileSystem.remove(processingPath);
        continue;
      }

      return {
        abandon: async () => {
          if (
            await this.#fileSystem.placeExclusive(processingPath, pendingPath)
          ) {
            return;
          }
          if (
            (
              await this.#fileSystem.list(
                this.#directory,
                queuePolicy.entryCount,
              )
            ).includes(name)
          ) {
            await this.#fileSystem.remove(processingPath);
            return;
          }
          ok(false, "Queue claim disappeared before abandonment.");
        },
        complete: async () => this.#fileSystem.remove(processingPath),
        request,
      };
    }

    return null;
  };
}
