/**
 * @file Verify queue storage through a workspace filesystem provider.
 */

import { describe, expect, it, vi } from "vitest";
import { FileType } from "vscode";
import { QueueFileTooLargeError } from "../../queue/file-system.js";
import {
  type WorkspaceFileSystem,
  WorkspaceQueueFileSystem,
} from "./file-system.js";

vi.mock("vscode", () => ({
  FileType: { Directory: 2, File: 1 },
}));

const createFileSystem = (): WorkspaceFileSystem<string> => ({
  createDirectory: vi.fn(),
  delete: vi.fn(),
  readDirectory: vi.fn().mockResolvedValue([]),
  readFile: vi.fn().mockResolvedValue(new Uint8Array()),
  rename: vi.fn(),
  stat: vi.fn().mockResolvedValue({ mtime: 10, size: 0, type: FileType.File }),
  writeFile: vi.fn(),
});

const createQueue = (fileSystem: WorkspaceFileSystem<string>) =>
  new WorkspaceQueueFileSystem({
    fileSystem,
    join: (directory, name) => `${directory}/${name}`,
  });

const createFileSystemError = (code: string) =>
  Object.assign(new Error("synthetic filesystem failure"), { code });

describe("WorkspaceQueueFileSystem", () => {
  it("bounds directory results", async () => {
    const fileSystem = createFileSystem();
    vi.mocked(fileSystem.readDirectory).mockResolvedValue([
      ["first", 1],
      ["second", 1],
      ["third", 1],
    ]);

    await expect(createQueue(fileSystem).list("queue", 2)).resolves.toEqual([
      "first",
      "second",
    ]);
  });

  it("rejects a file whose status exceeds the read limit", async () => {
    const fileSystem = createFileSystem();
    vi.mocked(fileSystem.stat).mockResolvedValue({
      mtime: 10,
      size: 2,
      type: FileType.File,
    });

    await expect(createQueue(fileSystem).read("request", 1)).rejects.toThrow(
      QueueFileTooLargeError,
    );
    expect(fileSystem.readFile).not.toHaveBeenCalled();
  });

  it("claims ownership and refreshes the processing file time", async () => {
    const fileSystem = createFileSystem();
    const byteList = new Uint8Array([1, 2, 3]);
    vi.mocked(fileSystem.stat).mockResolvedValue({
      mtime: 10,
      size: byteList.byteLength,
      type: FileType.File,
    });
    vi.mocked(fileSystem.readFile).mockResolvedValue(byteList);

    await expect(
      createQueue(fileSystem).claim({
        modificationTime: 20,
        source: "pending",
        target: "processing",
      }),
    ).resolves.toBe(true);
    expect(fileSystem.rename).toHaveBeenCalledWith("pending", "processing", {
      overwrite: false,
    });
    expect(fileSystem.writeFile).toHaveBeenCalledWith("processing", byteList);
  });

  it("treats an ownership race as an ordinary failed claim", async () => {
    const fileSystem = createFileSystem();
    vi.mocked(fileSystem.rename).mockRejectedValue(
      createFileSystemError("FileNotFound"),
    );

    await expect(
      createQueue(fileSystem).claim({
        modificationTime: 20,
        source: "pending",
        target: "processing",
      }),
    ).resolves.toBe(false);
  });

  it("returns null when a resource does not exist", async () => {
    const fileSystem = createFileSystem();
    vi.mocked(fileSystem.stat).mockRejectedValue(
      createFileSystemError("FileNotFound"),
    );

    await expect(
      createQueue(fileSystem).readModificationTime("request"),
    ).resolves.toBeNull();
  });

  it("ignores a file that disappears before deletion", async () => {
    const fileSystem = createFileSystem();
    vi.mocked(fileSystem.delete).mockRejectedValue(
      createFileSystemError("ENOENT"),
    );

    await createQueue(fileSystem).remove("request");

    expect(fileSystem.delete).toHaveBeenCalledWith("request", {
      recursive: false,
      useTrash: false,
    });
  });

  it("does not delete directories", async () => {
    const fileSystem = createFileSystem();
    vi.mocked(fileSystem.stat).mockResolvedValue({
      mtime: 10,
      size: 0,
      type: FileType.Directory,
    });

    await createQueue(fileSystem).remove("directory");

    expect(fileSystem.delete).not.toHaveBeenCalled();
  });
});
