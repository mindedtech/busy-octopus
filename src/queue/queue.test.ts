/**
 * @file Verify notification queue ownership, recovery, and bounds.
 */

import { ok } from "node:assert/strict";
import { describe, expect, it } from "vitest";
import {
  MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT,
  NotificationRequestJson,
} from "../protocol/notification.js";
import type { QueueFileSystem } from "./file-system.js";
import {
  NotificationQueue,
  NotificationQueuePublisher,
  queuePolicy,
} from "./queue.js";
import { MemoryQueueFileSystem } from "./test/file-system.js";
import { createRequest, REFERENCE_TIME } from "./test/request.js";

const DIRECTORY = "/queue";
const TOKEN = "0123456789abcdef0123456789abcdef";
const REFERENCE_NOW = Date.parse(REFERENCE_TIME) + 60_000;

const createQueue = ({
  clock = () => REFERENCE_NOW,
  fileSystem,
}: {
  clock?: () => number;
  fileSystem: MemoryQueueFileSystem;
}): NotificationQueue =>
  new NotificationQueue({
    clock,
    directory: DIRECTORY,
    fileSystem,
  });

const createPublisher = ({
  clock = () => REFERENCE_NOW,
  createToken = () => TOKEN,
  fileSystem,
}: {
  clock?: () => number;
  createToken?: () => string;
  fileSystem: MemoryQueueFileSystem;
}): NotificationQueuePublisher =>
  new NotificationQueuePublisher({
    clock,
    createToken,
    directory: DIRECTORY,
    fileSystem,
  });

const pendingPath = (token: string): string => `${DIRECTORY}/${token}.json`;
const processingPath = (token: string): string =>
  `${DIRECTORY}/${token}.processing`;

describe("NotificationQueuePublisher", () => {
  it("publishes through a temporary file and completes a claim", async () => {
    const fileSystem = new MemoryQueueFileSystem();
    const queue = createQueue({ fileSystem });
    const publisher = createPublisher({ fileSystem });
    const request = createRequest();

    await publisher.publish(request);

    expect(fileSystem.nameList(DIRECTORY)).toEqual([`${TOKEN}.json`]);
    expect(fileSystem.text(pendingPath(TOKEN))).toContain(
      request.notificationId,
    );

    const claim = await queue.claim();
    ok(claim !== null);
    expect(claim.request).toEqual(request);
    await claim.complete();
    expect(fileSystem.nameList(DIRECTORY)).toEqual([]);
  });

  it("removes its temporary file when publication loses ownership", async () => {
    const fileSystem = new MemoryQueueFileSystem({ disableTransition: true });
    const publisher = createPublisher({ fileSystem });

    await expect(publisher.publish(createRequest())).rejects.toThrow(
      "Temporary queue request disappeared before publication.",
    );
    expect(fileSystem.nameList(DIRECTORY)).toEqual([]);
  });

  it("preserves another publisher's temporary file", async () => {
    const fileSystem = new MemoryQueueFileSystem();
    const temporaryPath = `${DIRECTORY}/.publish.${TOKEN}.${REFERENCE_NOW}.tmp`;
    fileSystem.seed(temporaryPath, "other publisher");

    await expect(
      createPublisher({ fileSystem }).publish(createRequest()),
    ).rejects.toThrow("Queue file already exists.");

    expect(fileSystem.text(temporaryPath)).toBe("other publisher");
  });

  it("refuses publication when the observed queue is full", async () => {
    const fileSystem = new MemoryQueueFileSystem();
    for (let index = 0; index < queuePolicy.entryCount; index += 1) {
      fileSystem.seed(
        pendingPath(index.toString(16).padStart(32, "0")),
        NotificationRequestJson.encode(createRequest()),
      );
    }

    await expect(
      createPublisher({ fileSystem }).publish(createRequest()),
    ).rejects.toThrow("Notification queue is full.");
  });

  it("rejects an invalid publication token", async () => {
    const fileSystem = new MemoryQueueFileSystem();
    await expect(
      createPublisher({
        createToken: () => "unsafe/token",
        fileSystem,
      }).publish(createRequest()),
    ).rejects.toThrow("Queue token must contain 32 hexadecimal characters.");
  });

  it("does not replace a pending request after a token collision", async () => {
    const fileSystem = new MemoryQueueFileSystem();
    const request = createRequest({
      notificationId: "existing-notification",
    });
    fileSystem.seed(
      pendingPath(TOKEN),
      NotificationRequestJson.encode(request),
    );

    await expect(
      createPublisher({ fileSystem }).publish(
        createRequest({ notificationId: "new-notification" }),
      ),
    ).rejects.toThrow("Queue token already exists.");

    expect(fileSystem.text(pendingPath(TOKEN))).toContain(
      request.notificationId,
    );
  });
});

describe("NotificationQueue claims", () => {
  it("allows only one concurrent consumer to claim a request", async () => {
    const fileSystem = new MemoryQueueFileSystem();
    await createPublisher({ fileSystem }).publish(createRequest());

    const claimList = await Promise.all([
      createQueue({ fileSystem }).claim(),
      createQueue({ fileSystem }).claim(),
    ]);

    expect(claimList.filter((claim) => claim !== null)).toHaveLength(1);
  });

  it("claims through consumer-only filesystem capability", async () => {
    const storage = new MemoryQueueFileSystem();
    const fileSystem: QueueFileSystem = {
      createDirectory: storage.createDirectory,
      join: storage.join,
      list: storage.list,
      read: storage.read,
      remove: storage.remove,
      claim: storage.claim,
      readModificationTime: storage.readModificationTime,
      placeExclusive: storage.placeExclusive,
    };
    const queue = new NotificationQueue({
      clock: () => REFERENCE_NOW,
      directory: DIRECTORY,
      fileSystem,
    });

    await expect(queue.claim()).resolves.toBeNull();
  });

  it("returns abandoned ownership to the pending queue", async () => {
    const fileSystem = new MemoryQueueFileSystem();
    const queue = createQueue({ fileSystem });
    await createPublisher({ fileSystem }).publish(createRequest());

    const claim = await queue.claim();
    ok(claim !== null);
    await claim.abandon();

    expect(fileSystem.nameList(DIRECTORY)).toEqual([`${TOKEN}.json`]);
    await expect(queue.claim()).resolves.not.toBeNull();
  });

  it("preserves an existing pending request during abandonment", async () => {
    const fileSystem = new MemoryQueueFileSystem();
    const queue = createQueue({ fileSystem });
    await createPublisher({ fileSystem }).publish(createRequest());
    const claim = await queue.claim();
    ok(claim !== null);
    const request = createRequest({
      notificationId: "existing-notification",
    });
    fileSystem.seed(
      pendingPath(TOKEN),
      NotificationRequestJson.encode(request),
    );

    await claim.abandon();

    const nextClaim = await queue.claim();
    ok(nextClaim !== null);
    expect(nextClaim.request.notificationId).toBe(request.notificationId);
  });

  it("reports ownership loss during abandonment", async () => {
    const fileSystem = new MemoryQueueFileSystem();
    const queue = createQueue({ fileSystem });
    await createPublisher({ fileSystem }).publish(createRequest());
    const claim = await queue.claim();
    ok(claim !== null);
    await fileSystem.remove(processingPath(TOKEN));

    await expect(claim.abandon()).rejects.toThrow(
      "Queue claim disappeared before abandonment.",
    );
  });

  it("treats a lost pending claim as a competing-consumer race", async () => {
    const fileSystem = new MemoryQueueFileSystem({ disableTransition: true });
    fileSystem.seed(
      pendingPath(TOKEN),
      NotificationRequestJson.encode(createRequest()),
    );

    await expect(createQueue({ fileSystem }).claim()).resolves.toBeNull();
    expect(fileSystem.nameList(DIRECTORY)).toEqual([`${TOKEN}.json`]);
  });

  it("preserves a claim after an unexpected read failure", async () => {
    const fileSystem = new MemoryQueueFileSystem({
      readError: new Error("Synthetic queue read failure."),
    });
    await createPublisher({ fileSystem }).publish(createRequest());

    await expect(createQueue({ fileSystem }).claim()).rejects.toThrow(
      "Synthetic queue read failure.",
    );
    expect(fileSystem.nameList(DIRECTORY)).toEqual([`${TOKEN}.processing`]);
  });
});

describe("NotificationQueue validation", () => {
  it("removes malformed, unknown-version, invalid UTF-8, and oversized input", async () => {
    const fileSystem = new MemoryQueueFileSystem();
    fileSystem.seed(pendingPath("1".repeat(32)), "not json");
    fileSystem.seed(
      pendingPath("2".repeat(32)),
      NotificationRequestJson.encode(createRequest()).replace(
        '"schemaVersion":1',
        '"schemaVersion":2',
      ),
    );
    fileSystem.seed(pendingPath("3".repeat(32)), new Uint8Array([0xc3, 0x28]));
    fileSystem.seed(
      pendingPath("4".repeat(32)),
      new Uint8Array(MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT + 1),
    );

    await expect(createQueue({ fileSystem }).claim()).resolves.toBeNull();
    expect(fileSystem.nameList(DIRECTORY)).toEqual([]);
  });

  it("removes requests older than the configured lifetime", async () => {
    const fileSystem = new MemoryQueueFileSystem();
    fileSystem.seed(
      pendingPath(TOKEN),
      NotificationRequestJson.encode(createRequest()),
    );
    const now =
      Date.parse(REFERENCE_TIME) + queuePolicy.requestLifetimeMilliseconds + 1;

    await expect(
      createQueue({
        clock: () => now,
        fileSystem,
      }).claim(),
    ).resolves.toBeNull();
    expect(fileSystem.nameList(DIRECTORY)).toEqual([]);
  });

  it("preserves a request at the exact lifetime boundary", async () => {
    const fileSystem = new MemoryQueueFileSystem();
    fileSystem.seed(
      pendingPath(TOKEN),
      NotificationRequestJson.encode(createRequest()),
    );
    const now =
      Date.parse(REFERENCE_TIME) + queuePolicy.requestLifetimeMilliseconds;

    await expect(
      createQueue({
        clock: () => now,
        fileSystem,
      }).claim(),
    ).resolves.not.toBeNull();
  });
});

describe("NotificationQueue cleanup", () => {
  it("recovers an abandoned claim after its lifetime", async () => {
    let now = REFERENCE_NOW;
    const fileSystem = new MemoryQueueFileSystem();
    const queue = createQueue({ clock: () => now, fileSystem });
    await createPublisher({ clock: () => now, fileSystem }).publish(
      createRequest(),
    );
    await queue.claim();

    now += queuePolicy.claimLifetimeMilliseconds + 1;

    await expect(queue.claim()).resolves.not.toBeNull();
  });

  it("preserves a pending request during stale claim recovery", async () => {
    const claimTime = REFERENCE_NOW - queuePolicy.claimLifetimeMilliseconds - 1;
    const fileSystem = new MemoryQueueFileSystem({ clock: () => claimTime });
    const request = createRequest({
      notificationId: "existing-notification",
    });
    fileSystem.seed(
      pendingPath(TOKEN),
      NotificationRequestJson.encode(request),
    );
    fileSystem.seed(
      processingPath(TOKEN),
      NotificationRequestJson.encode(
        createRequest({ notificationId: "stale-notification" }),
      ),
    );

    const claim = await createQueue({ fileSystem }).claim();

    ok(claim !== null);
    expect(claim.request.notificationId).toBe(request.notificationId);
  });

  it("preserves fresh claim ownership", async () => {
    const fileSystem = new MemoryQueueFileSystem();
    const queue = createQueue({ fileSystem });
    await createPublisher({ fileSystem }).publish(createRequest());
    await queue.claim();

    await expect(queue.claim()).resolves.toBeNull();
    expect(fileSystem.nameList(DIRECTORY)).toEqual([`${TOKEN}.processing`]);
  });

  it("removes stale publication files while preserving fresh work", async () => {
    const fileSystem = new MemoryQueueFileSystem();
    fileSystem.seed(`${DIRECTORY}/.publish.${"1".repeat(32)}.1.tmp`);
    fileSystem.seed(
      `${DIRECTORY}/.publish.${"2".repeat(32)}.${REFERENCE_NOW}.tmp`,
    );

    await createQueue({ fileSystem }).claim();

    expect(fileSystem.nameList(DIRECTORY)).toEqual([
      `.publish.${"2".repeat(32)}.${REFERENCE_NOW}.tmp`,
    ]);
  });

  it("bounds cleanup candidate work", async () => {
    const listLimitList: number[] = [];
    const fileSystem = new MemoryQueueFileSystem({
      onList: (maximumEntryCount) => listLimitList.push(maximumEntryCount),
    });
    for (
      let index = 0;
      index < queuePolicy.cleanupCandidateCount + 6;
      index += 1
    ) {
      fileSystem.seed(`${DIRECTORY}/invalid-${index}`);
    }

    await createQueue({ fileSystem }).claim();

    expect(fileSystem.nameList(DIRECTORY)).toHaveLength(6);
    expect(listLimitList).toContain(
      queuePolicy.entryCount + queuePolicy.cleanupCandidateCount,
    );
  });
});
