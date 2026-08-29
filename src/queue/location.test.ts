/**
 * @file Verify platform-aware workspace queue locations.
 */

import { describe, expect, it } from "vitest";
import type { WorkspacePlatform } from "../workspace/identity.js";
import { locateWorkspaceQueue } from "./location.js";

const INSTANCE_IDENTIFIER = "a".repeat(64);

describe("locateWorkspaceQueue", () => {
  it("derives a POSIX temporary queue", () => {
    expect(
      locateWorkspaceQueue({
        instanceId: INSTANCE_IDENTIFIER,
        platform: "posix",
        temporaryDirectory: "/tmp/.",
      }),
    ).toBe(`/tmp/busy-octopus/v1/${INSTANCE_IDENTIFIER}`);
  });

  it("derives a Windows temporary queue", () => {
    expect(
      locateWorkspaceQueue({
        instanceId: INSTANCE_IDENTIFIER,
        platform: "win32",
        temporaryDirectory: "C:\\Temp\\.",
      }),
    ).toBe(`C:\\Temp\\busy-octopus\\v1\\${INSTANCE_IDENTIFIER}`);
  });

  it("preserves Windows UNC semantics", () => {
    expect(
      locateWorkspaceQueue({
        instanceId: INSTANCE_IDENTIFIER,
        platform: "win32",
        temporaryDirectory: "\\\\server\\share\\temp",
      }),
    ).toBe(`\\\\server\\share\\temp\\busy-octopus\\v1\\${INSTANCE_IDENTIFIER}`);
  });

  it.each<{ path: string; platform: WorkspacePlatform }>([
    { path: "tmp", platform: "posix" },
    { path: "Temp", platform: "win32" },
  ])("rejects a relative temporary directory", ({ path, platform }) => {
    expect(() =>
      locateWorkspaceQueue({
        instanceId: INSTANCE_IDENTIFIER,
        platform,
        temporaryDirectory: path,
      }),
    ).toThrow("Temporary directory must be absolute.");
  });

  it("rejects an unsafe workspace identifier", () => {
    expect(() =>
      locateWorkspaceQueue({
        instanceId: "../workspace",
        platform: "posix",
        temporaryDirectory: "/tmp",
      }),
    ).toThrow(
      "Workspace instance identifier must contain 64 hexadecimal characters.",
    );
  });
});
