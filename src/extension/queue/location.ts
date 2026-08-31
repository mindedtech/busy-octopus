/**
 * @file Derive queue resources for local and remote VS Code workspaces.
 */

import { tmpdir } from "node:os";
import { locateWorkspaceQueue } from "../../queue/location.js";
import {
  identifyWorkspace,
  type WorkspacePlatform,
} from "../../workspace/identity.js";

export type WorkspaceResourceLocation<Resource> = {
  fsPath: string;
  path: string;
  scheme: string;
  useRemotePath: (path: string) => Resource;
};

/**
 * Locate the producer queue through the workspace filesystem provider.
 */
export const locateExtensionWorkspaceQueue = <Resource>({
  createLocalResource,
  localPlatform,
  localTemporaryDirectory = tmpdir(),
  remoteTemporaryDirectory = "/tmp",
  workspace,
}: {
  createLocalResource: (path: string) => Resource;
  localPlatform: WorkspacePlatform;
  localTemporaryDirectory?: string;
  remoteTemporaryDirectory?: string;
  workspace: WorkspaceResourceLocation<Resource>;
}): Resource => {
  if (workspace.scheme === "file") {
    return createLocalResource(
      locateWorkspaceQueue({
        instanceId: identifyWorkspace({
          path: workspace.fsPath,
          platform: localPlatform,
        }).instanceId,
        platform: localPlatform,
        temporaryDirectory: localTemporaryDirectory,
      }),
    );
  }

  return workspace.useRemotePath(
    locateWorkspaceQueue({
      instanceId: identifyWorkspace({
        path: workspace.path,
        platform: "posix",
      }).instanceId,
      platform: "posix",
      temporaryDirectory: remoteTemporaryDirectory,
    }),
  );
};
