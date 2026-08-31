/**
 * @file Verify local and remote extension queue locations.
 */

import { describe, expect, it } from "vitest";
import { identifyWorkspace } from "../../workspace/identity.js";
import { locateExtensionWorkspaceQueue } from "./location.js";

describe("locateExtensionWorkspaceQueue", () => {
  it("uses a local file resource for a native workspace", () => {
    const instanceId = identifyWorkspace({
      path: "/work/project",
      platform: "posix",
    }).instanceId;

    expect(
      locateExtensionWorkspaceQueue({
        createLocalResource: (path) => `file://${path}`,
        localPlatform: "posix",
        localTemporaryDirectory: "/runtime/temp",
        workspace: {
          fsPath: "/work/project",
          path: "/work/project",
          scheme: "file",
          useRemotePath: (path) => `remote://${path}`,
        },
      }),
    ).toBe(`file:///runtime/temp/busy-octopus/v1/${instanceId}`);
  });

  it("keeps the provider for a remote POSIX workspace", () => {
    const instanceId = identifyWorkspace({
      path: "/workspaces/project",
      platform: "posix",
    }).instanceId;

    expect(
      locateExtensionWorkspaceQueue({
        createLocalResource: (path) => `file://${path}`,
        localPlatform: "win32",
        remoteTemporaryDirectory: "/tmp",
        workspace: {
          fsPath: "/workspaces/project",
          path: "/workspaces/project",
          scheme: "vscode-remote",
          useRemotePath: (path) => `vscode-remote://container${path}`,
        },
      }),
    ).toBe(`vscode-remote://container/tmp/busy-octopus/v1/${instanceId}`);
  });

  it("uses Windows path rules for a native Windows workspace", () => {
    const instanceId = identifyWorkspace({
      path: "C:\\Work\\Project",
      platform: "win32",
    }).instanceId;

    expect(
      locateExtensionWorkspaceQueue({
        createLocalResource: (path) => path,
        localPlatform: "win32",
        localTemporaryDirectory: "C:\\Temp",
        workspace: {
          fsPath: "C:\\Work\\Project",
          path: "/C:/Work/Project",
          scheme: "file",
          useRemotePath: (path) => path,
        },
      }),
    ).toBe(["C:\\Temp\\busy-octopus\\v1", instanceId].join("\\"));
  });
});
