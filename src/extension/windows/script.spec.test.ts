/**
 * @file Verify the packaged Windows PowerShell contract.
 */

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { z } from "zod";
import type { WindowCapture } from "./bridge.js";

const execFileAsync = promisify(execFile);
const scriptPath = "native/windows-notify.ps1";

it("uses safe native APIs and separate operations", async () => {
  const script = await readFile(scriptPath, "utf8");

  expect(script).toContain(
    String.raw`[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFE\uFFFF]`,
  );
  expect(script).toContain(
    /* xml */ `<toast activationType="protocol" launch="$xmlActivationUri">`,
  );
  expect(script).toContain(`$flashInfo.dwFlags = 0x00000002 -bor 0x00000004`);
  expect(script).toContain("GetForegroundWindow");
  expect(script).toContain("GetWindowThreadProcessId");
  expect(script).toContain("Get-CimInstance -ClassName Win32_Process");
  expect(script).not.toContain("EnumWindows");
});

it.runIf(process.platform === "win32")(
  "returns bounded JSON for an unavailable capture",
  { timeout: 20_000 },
  async () => {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-Operation",
        "captureWindow",
        "-EditorProcessId",
        "0",
      ],
      {
        encoding: "utf8",
        timeout: 15_000,
        windowsHide: true,
      },
    );

    expect(
      z
        .strictObject({
          status: z.literal("unavailable"),
          windowHandle: z.null(),
        })
        .parse(JSON.parse(stdout)),
    ).toEqual({
      status: "unavailable",
      windowHandle: null,
    } satisfies WindowCapture);
  },
);
