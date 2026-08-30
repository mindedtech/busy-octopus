/**
 * @file Resolve workspace context and its runtime-local queue location.
 */

import { tmpdir } from "node:os";
import { locateWorkspaceQueue } from "../queue/location.js";
import { resolveWorkspace, type WorkspaceResolution } from "./resolution.js";
import { nativeWorkspaceRuntime, type WorkspaceRuntime } from "./runtime.js";

/**
 * Carry resolved workspace context with its notification queue location.
 */
export type WorkspaceQueueResolution = WorkspaceResolution & {
  queueDirectory: string;
};

/**
 * Resolve a directory and locate its queue in runtime-local temporary storage.
 */
export const resolveWorkspaceQueue = async ({
  directory,
  runtime = nativeWorkspaceRuntime,
  temporaryDirectory = tmpdir(),
}: {
  directory?: string;
  runtime?: WorkspaceRuntime;
  temporaryDirectory?: string;
} = {}): Promise<WorkspaceQueueResolution> => {
  const resolution = await resolveWorkspace(
    directory === undefined ? { runtime } : { directory, runtime },
  );

  return {
    ...resolution,
    queueDirectory: locateWorkspaceQueue({
      instanceId: resolution.context.instanceId,
      platform: resolution.platform,
      temporaryDirectory,
    }),
  };
};
