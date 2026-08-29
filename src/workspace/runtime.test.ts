/**
 * @file Verify native workspace runtime process behavior.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(
    (
      _file: string,
      _argumentList: string[],
      _options: object,
      callback: (
        error: Error | null,
        output: string,
        errorOutput: string,
      ) => void,
    ) => {
      callback(null, "feature/example\n", "");
    },
  ),
}));

vi.mock("node:child_process", () => ({ execFile: execFileMock }));

import { nativeWorkspaceRuntime } from "./runtime.js";

afterEach(() => {
  execFileMock.mockClear();
});

describe("nativeWorkspaceRuntime", () => {
  it("reports the active Node.js path platform", () => {
    expect(nativeWorkspaceRuntime.platform).toBe(
      process.platform === "win32" ? "win32" : "posix",
    );
  });

  it("reads the current directory on demand", () => {
    expect(nativeWorkspaceRuntime.currentDirectory()).toBe(process.cwd());
  });

  it("runs Git with bounded separate arguments", async () => {
    await expect(
      nativeWorkspaceRuntime.git({
        argumentList: ["symbolic-ref", "--quiet", "--short", "HEAD"],
        directory: "/work/project",
      }),
    ).resolves.toBe("feature/example");
    expect(execFileMock).toHaveBeenCalledWith(
      "git",
      ["-C", "/work/project", "symbolic-ref", "--quiet", "--short", "HEAD"],
      {
        encoding: "utf8",
        maxBuffer: 4_096,
        timeout: 1_000,
        windowsHide: true,
      },
      expect.any(Function),
    );
  });

  it("returns null when Git rejects an operation", async () => {
    execFileMock.mockImplementationOnce(
      (_file, _argumentList, _options, callback) => {
        callback(new Error("Synthetic process failure."), "", "");
      },
    );

    await expect(
      nativeWorkspaceRuntime.git({
        argumentList: ["rev-parse", "--show-toplevel"],
        directory: "/work/project",
      }),
    ).resolves.toBeNull();
  });
});
