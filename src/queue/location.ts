/**
 * @file Derive workspace queue locations in runtime-local temporary storage.
 */

import { ok } from "node:assert/strict";
import { posix, win32 } from "node:path";
import type { WorkspacePlatform } from "../workspace/identity.js";

const WORKSPACE_INSTANCE_IDENTIFIER_PATTERN = /^[a-f0-9]{64}$/u;

/**
 * Locate one workspace queue below the runtime's temporary directory.
 */
export const locateWorkspaceQueue = ({
  instanceId,
  platform,
  temporaryDirectory,
}: {
  instanceId: string;
  platform: WorkspacePlatform;
  temporaryDirectory: string;
}): string => {
  ok(
    WORKSPACE_INSTANCE_IDENTIFIER_PATTERN.test(instanceId),
    "Workspace instance identifier must contain 64 hexadecimal characters.",
  );

  switch (platform) {
    case "posix":
      ok(
        posix.isAbsolute(temporaryDirectory),
        "Temporary directory must be absolute.",
      );
      return posix.join(temporaryDirectory, "busy-octopus", "v1", instanceId);
    case "win32":
      ok(
        win32.isAbsolute(temporaryDirectory),
        "Temporary directory must be absolute.",
      );
      return win32.join(temporaryDirectory, "busy-octopus", "v1", instanceId);
  }
};
