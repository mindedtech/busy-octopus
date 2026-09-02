/**
 * @file Remote queue resources for VS Code workspaces.
 */

import { locateWorkspaceQueue } from "../../queue/location.js";

/**
 * Locate a remote producer queue through its workspace filesystem provider.
 */
export const locateRemoteWorkspaceQueue = <Resource>({
  instanceId,
  useRemotePath,
}: {
  /**
   * Stable identity of the remote workspace.
   */
  instanceId: string;

  /**
   * Conversion from a remote POSIX path to a filesystem resource.
   */
  useRemotePath: (path: string) => Resource;
}): Resource =>
  useRemotePath(
    locateWorkspaceQueue({
      instanceId,
      platform: "posix",
      temporaryDirectory: "/tmp",
    }),
  );
