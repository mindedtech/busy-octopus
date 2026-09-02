/**
 * @file Verify canonical workspace identity behavior.
 */

import { describe, expect, it } from "vitest";
import { identifyWorkspace } from "./identity.js";

describe("identifyWorkspace", () => {
  it("normalizes POSIX paths while preserving case and Unicode", () => {
    const identity = identifyWorkspace({
      path: "/work/Δ Project/../Δ Project",
      platform: "posix",
    });

    expect(identity.path).toBe("/work/Δ Project");
    expect(identity.instanceId).toMatch(/^[a-f0-9]{64}$/u);
    expect(
      identifyWorkspace({ path: "/work/δ project", platform: "posix" })
        .instanceId,
    ).not.toBe(identity.instanceId);
  });

  it("normalizes Windows drive paths case-insensitively", () => {
    expect(
      identifyWorkspace({
        path: "C:\\Work\\Busy Octopus\\.\\src\\..",
        platform: "win32",
      }),
    ).toEqual(
      identifyWorkspace({
        path: "c:/work/busy octopus",
        platform: "win32",
      }),
    );
  });

  it("normalizes Windows UNC paths case-insensitively", () => {
    expect(
      identifyWorkspace({
        path: "\\\\SERVER\\Share\\Project",
        platform: "win32",
      }),
    ).toEqual(
      identifyWorkspace({
        path: "//server/share/project",
        platform: "win32",
      }),
    );
  });

  it("separates path semantics in the identity domain", () => {
    const posixIdentity = identifyWorkspace({
      path: "/workspace",
      platform: "posix",
    });
    const windowsIdentity = identifyWorkspace({
      path: "/workspace",
      platform: "win32",
    });

    expect(posixIdentity.instanceId).not.toBe(windowsIdentity.instanceId);
  });

  it("keeps a stable full digest for the reference location", () => {
    expect(
      identifyWorkspace({ path: "/work/project", platform: "posix" })
        .instanceId,
    ).toBe("7e9ec2742c8662ee0e37dc281c8aff837c2dbf01a7f60e490d56619bb2d7bfe4");
  });

  it.each([
    ["posix", "relative/project"],
    ["win32", "relative\\project"],
  ] as const)("rejects a relative %s path", (platform, path) => {
    expect(() => identifyWorkspace({ path, platform })).toThrow(
      "Workspace path must be absolute.",
    );
  });

  it("normalizes platform roots", () => {
    expect(identifyWorkspace({ path: "/.", platform: "posix" }).path).toBe("/");
    expect(identifyWorkspace({ path: "C:\\.\\", platform: "win32" }).path).toBe(
      "c:/",
    );
  });
});
