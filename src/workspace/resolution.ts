/**
 * @file Resolve notification workspace identity and display context.
 */

import { posix, win32 } from "node:path";
import {
  WorkspaceBranch,
  WorkspaceContext,
  WorkspaceLabel,
} from "../protocol/workspace.js";
import { identifyWorkspace, type WorkspacePlatform } from "./identity.js";
import { nativeWorkspaceRuntime, type WorkspaceRuntime } from "./runtime.js";

/**
 * Carry notification context with its canonical runtime location.
 */
export type WorkspaceResolution = {
  context: WorkspaceContext;
  path: string;
  platform: WorkspacePlatform;
};

const queryGit = async ({
  argumentList,
  directory,
  git,
}: {
  argumentList: string[];
  directory: string;
  git: WorkspaceRuntime["git"];
}): Promise<string | null> => {
  try {
    return await git({ argumentList, directory });
  } catch {
    return null;
  }
};

const findWorkspacePath = async ({
  canonicalize,
  git,
  path,
}: Pick<WorkspaceRuntime, "canonicalize" | "git"> & {
  path: string;
}): Promise<string> => {
  const root = await queryGit({
    argumentList: ["rev-parse", "--show-toplevel"],
    directory: path,
    git,
  });

  if (root === null) {
    return path;
  }

  try {
    return await canonicalize(root);
  } catch {
    return path;
  }
};

const deriveLabel = ({
  path,
  platform,
}: {
  path: string;
  platform: WorkspacePlatform;
}): string => {
  switch (platform) {
    case "posix":
      return posix.basename(path);
    case "win32":
      return win32.basename(path);
  }
};

/**
 * Resolve a directory into notification workspace context.
 */
export const resolveWorkspace = async ({
  directory,
  runtime = nativeWorkspaceRuntime,
}: {
  directory?: string;
  runtime?: WorkspaceRuntime;
} = {}): Promise<WorkspaceResolution> => {
  const selection = await runtime.canonicalize(
    directory ?? runtime.currentDirectory(),
  );
  const workspacePath = await findWorkspacePath({
    canonicalize: runtime.canonicalize,
    git: runtime.git,
    path: selection,
  });
  const { instanceId, path, platform } = identifyWorkspace({
    path: workspacePath,
    platform: runtime.platform,
  });
  const labelResult = WorkspaceLabel.safeParse(
    deriveLabel({ path: workspacePath, platform }),
  );
  const branchResult = WorkspaceBranch.safeParse(
    await queryGit({
      argumentList: ["symbolic-ref", "--quiet", "--short", "HEAD"],
      directory: workspacePath,
      git: runtime.git,
    }),
  );

  return {
    context: WorkspaceContext.parse({
      instanceId,
      display: {
        label: labelResult.success ? labelResult.data : null,
        branch: branchResult.success ? branchResult.data : null,
      },
    }),
    path,
    platform,
  };
};
