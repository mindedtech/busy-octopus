/**
 * @file Derive remote queue resources for VS Code workspaces.
 */

import { locateWorkspaceQueue } from "../../queue/location.js";
import { identifyWorkspace } from "../../workspace/identity.js";

/**
 * Locate a remote producer queue through its workspace filesystem provider.
 */
export const locateRemoteWorkspaceQueue = <Resource>({
  remoteTemporaryDirectory = "/tmp",
  workspace,
}: {
  remoteTemporaryDirectory?: string;
  workspace: {
    path: string;
    useRemotePath: (path: string) => Resource;
  };
}): Resource =>
  workspace.useRemotePath(
    locateWorkspaceQueue({
      instanceId: identifyWorkspace({
        path: workspace.path,
        platform: "posix",
      }).instanceId,
      platform: "posix",
      temporaryDirectory: remoteTemporaryDirectory,
    }),
  );
