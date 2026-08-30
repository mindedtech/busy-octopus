/**
 * @file Verify programmatic notification publication.
 */

import { ok } from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT,
  type NotificationRequest,
} from "../protocol/notification.js";
import { locateWorkspaceQueue } from "../queue/location.js";
import { nativeQueueFileSystem } from "../queue/native.js";
import { NotificationQueue, queuePolicy } from "../queue/queue.js";
import { resolveWorkspace } from "../workspace/resolution.js";
import { notify } from "./notify.js";

const execFileAsync = promisify(execFile);

const REFERENCE_TIME = "2026-08-29T12:34:56.789Z";
const ORIGINAL_DIRECTORY = process.cwd();
const directoryList: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "busy-octopus-library-"));
  directoryList.push(directory);
  return directory;
};

const locateQueue = async (directory: string): Promise<string> => {
  const { context, platform } = await resolveWorkspace({ directory });
  const queueDirectory = locateWorkspaceQueue({
    instanceId: context.instanceId,
    platform,
    temporaryDirectory: tmpdir(),
  });
  directoryList.push(queueDirectory);
  return queueDirectory;
};

const claimRequest = async (
  directory: string,
): Promise<NotificationRequest> => {
  const queue = new NotificationQueue({
    directory: await locateQueue(directory),
    fileSystem: nativeQueueFileSystem,
  });
  const claim = await queue.claim();
  ok(claim !== null, "Notification request must reach the workspace queue.");
  await claim.complete();
  return claim.request;
};

afterEach(async () => {
  process.chdir(ORIGINAL_DIRECTORY);
  vi.useRealTimers();
  await Promise.all(
    directoryList
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("notify", () => {
  it("publishes caller content for an explicit workspace", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(REFERENCE_TIME);
    const directory = await createTemporaryDirectory();

    const result = await notify({
      body: "Review the synthetic result.",
      directory,
      notificationId: "synthetic-notification",
      source: { kind: "test", name: "Synthetic runner" },
      title: "Synthetic task finished",
    });

    expect(result).toEqual({ notificationId: "synthetic-notification" });
    await expect(claimRequest(directory)).resolves.toMatchObject({
      schemaVersion: 1,
      notificationId: "synthetic-notification",
      creationTime: REFERENCE_TIME,
      title: "Synthetic task finished",
      body: "Review the synthetic result.",
      workspace: {
        display: { branch: null, label: basename(directory) },
      },
      source: { kind: "test", name: "Synthetic runner" },
    });
  });

  it("publishes linked-worktree context", async () => {
    const fixtureDirectory = await createTemporaryDirectory();
    const repositoryDirectory = join(fixtureDirectory, "repository");
    const worktreeDirectory = join(fixtureDirectory, "feature-worktree");
    const selectionDirectory = join(worktreeDirectory, "src");
    await mkdir(repositoryDirectory);
    await execFileAsync(
      "git",
      ["init", "--quiet", "--initial-branch=main", repositoryDirectory],
      { windowsHide: true },
    );
    await execFileAsync(
      "git",
      [
        "-C",
        repositoryDirectory,
        "worktree",
        "add",
        "--quiet",
        "--orphan",
        "-b",
        "feature/library",
        worktreeDirectory,
      ],
      { windowsHide: true },
    );
    await mkdir(selectionDirectory);

    await notify({
      body: null,
      directory: selectionDirectory,
      source: null,
      title: "Synthetic task finished",
    });

    const request = await claimRequest(selectionDirectory);
    const { context } = await resolveWorkspace({
      directory: worktreeDirectory,
    });
    expect(request.workspace).toEqual(context);
    expect(request.workspace.display).toEqual({
      branch: "feature/library",
      label: basename(worktreeDirectory),
    });
  });

  it("uses the current directory when no workspace is selected", async () => {
    const directory = await createTemporaryDirectory();
    process.chdir(directory);

    const { notificationId } = await notify({
      body: null,
      source: null,
      title: "Synthetic task finished",
    });

    await expect(claimRequest(directory)).resolves.toMatchObject({
      notificationId,
      body: null,
      source: null,
    });
  });

  it("generates an identifier when the caller omits one", async () => {
    const directory = await createTemporaryDirectory();

    const { notificationId } = await notify({
      body: null,
      directory,
      source: null,
      title: "Synthetic task finished",
    });

    expect(notificationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    );
    await expect(claimRequest(directory)).resolves.toMatchObject({
      notificationId,
    });
  });

  it("rejects invalid content before creating a queue", async () => {
    const directory = await createTemporaryDirectory();
    const queueDirectory = await locateQueue(directory);
    await rm(queueDirectory, { force: true, recursive: true });

    await expect(
      notify({ body: null, directory, source: null, title: " " }),
    ).rejects.toThrow();
    await expect(
      nativeQueueFileSystem.list(queueDirectory, 1),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects an oversized request before creating a queue", async () => {
    const directory = await createTemporaryDirectory();
    const queueDirectory = await locateQueue(directory);
    await rm(queueDirectory, { force: true, recursive: true });

    await expect(
      notify({
        body: "😀".repeat(1_024),
        directory,
        source: null,
        title: "Synthetic task finished",
      }),
    ).rejects.toThrow(
      `Notification request must not exceed ${MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT} UTF-8 bytes.`,
    );
    await expect(
      nativeQueueFileSystem.list(queueDirectory, 1),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("keeps publication failure observable when the queue is full", async () => {
    const directory = await createTemporaryDirectory();
    const queueDirectory = await locateQueue(directory);
    await mkdir(queueDirectory, { recursive: true });
    await Promise.all(
      Array.from({ length: queuePolicy.entryCount }, async (_, index) =>
        writeFile(
          join(queueDirectory, `${index.toString(16).padStart(32, "0")}.json`),
          "",
        ),
      ),
    );

    await expect(
      notify({
        body: null,
        directory,
        source: null,
        title: "Synthetic task finished",
      }),
    ).rejects.toThrow("Notification queue is full.");
  });
});
