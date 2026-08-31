/**
 * @file Verify remote extension queue locations.
 */

import { describe, expect, it } from "vitest";
import { identifyWorkspace } from "../../workspace/identity.js";
import { locateRemoteWorkspaceQueue } from "./location.js";

describe("locateRemoteWorkspaceQueue", () => {
  it("keeps the provider for a remote POSIX workspace", () => {
    const instanceId = identifyWorkspace({
      path: "/workspaces/project",
      platform: "posix",
    }).instanceId;

    expect(
      locateRemoteWorkspaceQueue({
        remoteTemporaryDirectory: "/tmp",
        workspace: {
          path: "/workspaces/project",
          useRemotePath: (path) => `vscode-remote://container${path}`,
        },
      }),
    ).toBe(`vscode-remote://container/tmp/busy-octopus/v1/${instanceId}`);
  });
});
