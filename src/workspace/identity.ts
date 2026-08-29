/**
 * @file Derive stable identities from canonical workspace locations.
 */

import { ok } from "node:assert/strict";
import { createHash } from "node:crypto";
import { posix, win32 } from "node:path";
import { z } from "zod";

const WORKSPACE_IDENTITY_DOMAIN = "busy-octopus/workspace/v1\0";

export const WorkspacePlatform = z
  .enum(["posix", "win32"])
  .describe("Select workspace runtime path semantics.");

export type WorkspacePlatform = z.infer<typeof WorkspacePlatform>;

export const WorkspaceLocation = z
  .strictObject({
    path: z.string().min(1).describe("Locate a workspace in its runtime."),
    platform: WorkspacePlatform,
  })
  .describe("Locate a workspace with explicit path semantics.");

export type WorkspaceLocation = z.infer<typeof WorkspaceLocation>;

/**
 * Carry a normalized location and its opaque routing identifier.
 */
export type WorkspaceIdentity = WorkspaceLocation & {
  instanceId: string;
};

const normalizeWorkspacePath = ({
  path,
  platform,
}: WorkspaceLocation): string => {
  switch (platform) {
    case "posix":
      ok(posix.isAbsolute(path), "Workspace path must be absolute.");
      return posix.normalize(path);
    case "win32":
      ok(win32.isAbsolute(path), "Workspace path must be absolute.");
      return win32.normalize(path).replaceAll("\\", "/").toLowerCase();
  }
};

/**
 * Derive routing identity from a canonical runtime location.
 */
export const identifyWorkspace = (
  input: WorkspaceLocation,
): WorkspaceIdentity => {
  const { path: inputPath, platform } = WorkspaceLocation.parse(input);
  const path = normalizeWorkspacePath({ path: inputPath, platform });

  return {
    instanceId: createHash("sha256")
      .update(WORKSPACE_IDENTITY_DOMAIN)
      .update(platform)
      .update("\0")
      .update(path)
      .digest("hex"),
    path,
    platform,
  };
};
