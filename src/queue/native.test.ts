/**
 * @file Verify bounded native queue filesystem behavior.
 */

import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { QueueFileTooLargeError } from "./file-system.js";
import { nativeQueueFileSystem } from "./native.js";
import { NotificationQueue, NotificationQueuePublisher } from "./queue.js";
import { createRequest, REFERENCE_TIME } from "./test/request.js";

const directoryList: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), "busy-octopus-test-"));
  directoryList.push(path);
  return path;
};

afterEach(async () => {
  await Promise.all(
    directoryList
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("nativeQueueFileSystem", () => {
  it("creates private queue storage", async () => {
    const root = await createTemporaryDirectory();
    const directory = join(root, "queue");
    const file = join(directory, "request.json");

    await nativeQueueFileSystem.createDirectory(directory);
    await nativeQueueFileSystem.writeExclusive(
      file,
      new TextEncoder().encode("request"),
    );

    await expect(nativeQueueFileSystem.read(file, 7)).resolves.toEqual(
      new TextEncoder().encode("request"),
    );
    await expect(nativeQueueFileSystem.list(directory, 1)).resolves.toEqual([
      "request.json",
    ]);
    await expect(nativeQueueFileSystem.list(directory, 0)).resolves.toEqual([]);
  });

  it("allows only one native consumer to claim a request", async () => {
    const root = await createTemporaryDirectory();
    const directory = join(root, "queue");
    const config = {
      clock: () => Date.parse(REFERENCE_TIME) + 60_000,
      directory,
      fileSystem: nativeQueueFileSystem,
    };
    const publisher = new NotificationQueuePublisher({
      ...config,
      createToken: () => "0123456789abcdef0123456789abcdef",
    });
    await publisher.publish(createRequest());

    const claimList = await Promise.all([
      new NotificationQueue(config).claim("window-1"),
      new NotificationQueue(config).claim("window-2"),
    ]);

    expect(claimList.filter((claim) => claim !== null)).toHaveLength(1);
    await Promise.all(
      claimList
        .filter((claim) => claim !== null)
        .map((claim) => claim.complete()),
    );
    await expect(nativeQueueFileSystem.list(directory, 1)).resolves.toEqual([]);
  });

  it.runIf(platform() !== "win32")(
    "restricts directory and file permissions",
    async () => {
      const root = await createTemporaryDirectory();
      const directory = join(root, "queue");
      const file = join(directory, "request.json");

      await nativeQueueFileSystem.createDirectory(directory);
      await nativeQueueFileSystem.writeExclusive(file, new Uint8Array());

      expect((await stat(directory)).mode & 0o777).toBe(0o700);
      expect((await stat(file)).mode & 0o777).toBe(0o600);
    },
  );

  it("rejects oversized queue input before returning bytes", async () => {
    const root = await createTemporaryDirectory();
    const file = join(root, "oversized.json");
    await writeFile(file, new Uint8Array(17));

    await expect(nativeQueueFileSystem.read(file, 16)).rejects.toEqual(
      new QueueFileTooLargeError(16),
    );
  });

  it("does not replace a file during exclusive creation", async () => {
    const root = await createTemporaryDirectory();
    const file = join(root, "request.json");
    await nativeQueueFileSystem.writeExclusive(file, new Uint8Array());

    await expect(
      nativeQueueFileSystem.writeExclusive(file, new Uint8Array()),
    ).rejects.toMatchObject({ code: "EEXIST" });
  });

  it("leaves directories for their lifecycle owner", async () => {
    const root = await createTemporaryDirectory();
    const directory = join(root, "unexpected");
    await mkdir(directory);

    await expect(
      nativeQueueFileSystem.remove(directory),
    ).resolves.toBeUndefined();
    await expect(stat(directory)).resolves.toBeDefined();
  });

  it("treats source disappearance as an ordinary rename race", async () => {
    const root = await createTemporaryDirectory();

    await expect(
      nativeQueueFileSystem.rename(join(root, "missing"), join(root, "target")),
    ).resolves.toBe(false);
  });

  it("does not replace an existing target during exclusive placement", async () => {
    const root = await createTemporaryDirectory();
    const source = join(root, "source");
    const target = join(root, "target");
    await writeFile(source, "source");
    await writeFile(target, "target");

    await expect(
      nativeQueueFileSystem.placeExclusive(source, target),
    ).resolves.toBe(false);
    await expect(nativeQueueFileSystem.read(target, 6)).resolves.toEqual(
      new TextEncoder().encode("target"),
    );
  });
});
