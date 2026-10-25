/**
 * @file Verify the bounded Windows PowerShell process contract.
 */

import type {
  execFile,
  ExecFileOptionsWithStringEncoding,
} from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import {
  captureEditorWindow,
  EditorProcessId,
  EditorWindowHandle,
  type NativeOperation,
  showWindowsNotification,
  startEditorWindowFlash,
  type WindowCapture,
} from "./bridge.js";

type ExecFile = typeof execFile;
type ExecFileAsync = typeof execFile.__promisify__;

const processMock = vi.hoisted(() => {
  const execFile = vi.fn<ExecFile>();
  const execFileAsync = vi.fn<ExecFileAsync>();

  Object.defineProperty(execFile, Symbol.for("nodejs.util.promisify.custom"), {
    value: execFileAsync,
  });

  return { execFile, execFileAsync };
});

vi.mock("node:child_process", () => ({ execFile: processMock.execFile }));

const scriptPath = String.raw`C:\extension\native\windows-notify.ps1`;
const editorProcessId = EditorProcessId.parse(12_345);
const windowHandle = EditorWindowHandle.parse("987654");

describe("Windows PowerShell bridge", () => {
  beforeEach(() => {
    processMock.execFileAsync.mockReset();
  });

  it("passes notification text as separate process arguments", async () => {
    processMock.execFileAsync.mockResolvedValue({
      stderr: "",
      stdout: JSON.stringify({ status: "success" } satisfies NativeOperation),
    });
    const signal = new AbortController().signal;

    await showWindowsNotification({
      activationUri: "vscode://file/c:/synthetic-workspace",
      appName: "Visual Studio Code",
      body: "Review $(ignored); result",
      scriptPath,
      signal,
      sound: false,
      title: "Agent & finished",
    });

    expect(processMock.execFileAsync).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining([
        "-Title",
        "Agent & finished",
        "-Body",
        "Review $(ignored); result",
        "-Sound",
        "false",
      ] satisfies string[]),
      expect.objectContaining({
        encoding: "utf8",
        maxBuffer: 16_384,
        signal,
        timeout: 5_000,
        windowsHide: true,
      } satisfies Partial<ExecFileOptionsWithStringEncoding>),
    );
  });

  it("rejects malformed native output", async () => {
    processMock.execFileAsync.mockResolvedValue({ stderr: "", stdout: "{}" });

    await expect(
      captureEditorWindow({ editorProcessId, scriptPath }),
    ).rejects.toThrow(ZodError);
  });

  it("parses a captured window handle", async () => {
    processMock.execFileAsync.mockResolvedValue({
      stderr: "",
      stdout: JSON.stringify({
        status: "success",
        windowHandle,
      } satisfies WindowCapture),
    });

    await expect(
      captureEditorWindow({ editorProcessId, scriptPath }),
    ).resolves.toEqual({
      status: "success",
      windowHandle,
    } satisfies WindowCapture);
  });

  it("passes flash arguments and cancellation separately", async () => {
    processMock.execFileAsync.mockResolvedValue({
      stderr: "",
      stdout: JSON.stringify({ status: "success" } satisfies NativeOperation),
    });
    const signal = new AbortController().signal;

    await startEditorWindowFlash({
      editorProcessId,
      scriptPath,
      signal,
      windowHandle,
    });

    expect(processMock.execFileAsync).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining([
        "-Operation",
        "startTaskbarFlash",
        "-EditorProcessId",
        "12345",
        "-EditorWindowHandle",
        "987654",
      ] satisfies string[]),
      expect.objectContaining({ signal } satisfies Pick<
        ExecFileOptionsWithStringEncoding,
        "signal"
      >),
    );
  });

  it.each([
    ["12345", 12_345],
    [12_345, 12_345],
    ["", null],
    ["0", null],
    ["unknown", null],
  ])("parses editor process identifier %j", (input, output) => {
    expect(EditorProcessId.nullable().catch(null).parse(input)).toBe(output);
  });
});
