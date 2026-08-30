/**
 * @file Verify shared workspace queue resolution.
 */

import { expect, it } from "vitest";
import { resolveWorkspaceQueue } from "./queue.js";
import type { WorkspaceRuntime } from "./runtime.js";

it("locates the queue from the resolved workspace identity", async () => {
  const runtime: WorkspaceRuntime = {
    canonicalize: async (path) => path,
    currentDirectory: () => "/work/project",
    git: async () => null,
    platform: "posix",
  };

  const resolution = await resolveWorkspaceQueue({
    runtime,
    temporaryDirectory: "/runtime/temp",
  });

  expect(resolution).toMatchObject({
    context: { display: { branch: null, label: "project" } },
    path: "/work/project",
    platform: "posix",
  });
  expect(resolution.queueDirectory).toBe(
    `/runtime/temp/busy-octopus/v1/${resolution.context.instanceId}`,
  );
});
