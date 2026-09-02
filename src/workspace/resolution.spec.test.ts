/**
 * @file Verify workspace selection and context resolution.
 */

import { describe, expect, it, vi } from "vitest";
import { resolveWorkspace } from "./resolution.js";
import type { WorkspaceRuntime } from "./runtime.js";

const createRuntime = ({
  canonicalize = async (path: string) => path,
  currentDirectory = "/work/current",
  git = async ({ argumentList }: { argumentList: string[] }) =>
    argumentList[0] === "rev-parse" ? "/work/project" : "feature/example",
  platform = "posix",
}: {
  canonicalize?: WorkspaceRuntime["canonicalize"];
  currentDirectory?: string;
  git?: WorkspaceRuntime["git"];
  platform?: WorkspaceRuntime["platform"];
} = {}) => {
  const currentDirectoryOperation = vi.fn(() => currentDirectory);
  const gitOperation = vi.fn(git);
  const canonicalizeOperation = vi.fn(canonicalize);
  const runtime: WorkspaceRuntime = {
    canonicalize: canonicalizeOperation,
    currentDirectory: currentDirectoryOperation,
    git: gitOperation,
    platform,
  };

  return {
    canonicalizeOperation,
    currentDirectoryOperation,
    gitOperation,
    runtime,
  };
};

describe("resolveWorkspace", () => {
  it("uses the current directory by default", async () => {
    const { currentDirectoryOperation, runtime } = createRuntime();

    await resolveWorkspace({ runtime });

    expect(currentDirectoryOperation).toHaveBeenCalledOnce();
  });

  it("prefers an explicit directory", async () => {
    const { canonicalizeOperation, currentDirectoryOperation, runtime } =
      createRuntime();

    await resolveWorkspace({ directory: "/work/explicit", runtime });

    expect(currentDirectoryOperation).not.toHaveBeenCalled();
    expect(canonicalizeOperation).toHaveBeenNthCalledWith(1, "/work/explicit");
  });

  it("uses the canonical Git checkout and branch", async () => {
    const { canonicalizeOperation, gitOperation, runtime } = createRuntime({
      canonicalize: async (path) => path.replace("-link", ""),
      currentDirectory: "/work/project-link/src",
      git: async ({ argumentList }) =>
        argumentList[0] === "rev-parse"
          ? "/work/project-link"
          : "feature/example",
    });

    const resolution = await resolveWorkspace({ runtime });

    expect(canonicalizeOperation).toHaveBeenNthCalledWith(
      1,
      "/work/project-link/src",
    );
    expect(canonicalizeOperation).toHaveBeenNthCalledWith(
      2,
      "/work/project-link",
    );
    expect(gitOperation).toHaveBeenNthCalledWith(1, {
      argumentList: ["rev-parse", "--show-toplevel"],
      directory: "/work/project/src",
    });
    expect(gitOperation).toHaveBeenNthCalledWith(2, {
      argumentList: ["symbolic-ref", "--quiet", "--short", "HEAD"],
      directory: "/work/project",
    });
    expect(resolution).toMatchObject({
      context: {
        display: { branch: "feature/example", label: "project" },
      },
      path: "/work/project",
      platform: "posix",
    });
  });

  it("resolves a non-Git directory", async () => {
    const { runtime } = createRuntime({
      currentDirectory: "/work/plain",
      git: async () => null,
    });

    await expect(resolveWorkspace({ runtime })).resolves.toMatchObject({
      context: { display: { branch: null, label: "plain" } },
      path: "/work/plain",
    });
  });

  it("keeps Git failures optional", async () => {
    const { runtime } = createRuntime({
      currentDirectory: "/work/plain",
      git: async () => {
        throw new Error("Synthetic Git failure.");
      },
    });

    await expect(resolveWorkspace({ runtime })).resolves.toMatchObject({
      context: { display: { branch: null, label: "plain" } },
      path: "/work/plain",
    });
  });

  it("falls back when Git root canonicalization fails", async () => {
    const { runtime } = createRuntime({
      canonicalize: async (path) => {
        if (path === "/work/git-root") {
          throw new Error("Synthetic canonicalization failure.");
        }

        return path;
      },
      currentDirectory: "/work/selection",
      git: async ({ argumentList }) =>
        argumentList[0] === "rev-parse" ? "/work/git-root" : null,
    });

    await expect(resolveWorkspace({ runtime })).resolves.toMatchObject({
      context: { display: { branch: null, label: "selection" } },
      path: "/work/selection",
    });
  });

  it("maps checkout subdirectories to one identity", async () => {
    const resolutionList = await Promise.all(
      ["/work/project/src", "/work/project/test"].map(
        async (currentDirectory) =>
          resolveWorkspace({
            runtime: createRuntime({
              currentDirectory,
              git: async ({ argumentList }) =>
                argumentList[0] === "rev-parse" ? "/work/project" : null,
            }).runtime,
          }),
      ),
    );

    expect(resolutionList[0]?.context.instanceId).toBe(
      resolutionList[1]?.context.instanceId,
    );
  });

  it("represents detached HEAD with a null branch", async () => {
    const { runtime } = createRuntime({
      git: async ({ argumentList }) =>
        argumentList[0] === "rev-parse" ? "/work/project" : null,
    });

    await expect(resolveWorkspace({ runtime })).resolves.toMatchObject({
      context: { display: { branch: null, label: "project" } },
    });
  });

  it("represents a platform root with a null label", async () => {
    const { runtime } = createRuntime({
      currentDirectory: "/",
      git: async () => null,
    });

    await expect(resolveWorkspace({ runtime })).resolves.toMatchObject({
      context: { display: { branch: null, label: null } },
      path: "/",
    });
  });

  it("keeps linked worktrees distinct", async () => {
    const primary = await resolveWorkspace({
      runtime: createRuntime({
        currentDirectory: "/work/project/src",
        git: async ({ argumentList }) =>
          argumentList[0] === "rev-parse" ? "/work/project" : null,
      }).runtime,
    });
    const worktree = await resolveWorkspace({
      runtime: createRuntime({
        currentDirectory: "/work/project-feature/src",
        git: async ({ argumentList }) =>
          argumentList[0] === "rev-parse" ? "/work/project-feature" : null,
      }).runtime,
    });

    expect(primary.context.instanceId).not.toBe(worktree.context.instanceId);
  });

  it("omits invalid display metadata without changing identity", async () => {
    const path = `/work/${"a".repeat(121)}`;
    const identityList = await Promise.all(
      [" ", "a".repeat(257)].map(async (branch) =>
        resolveWorkspace({
          runtime: createRuntime({
            currentDirectory: path,
            git: async ({ argumentList }) =>
              argumentList[0] === "rev-parse" ? path : branch,
          }).runtime,
        }),
      ),
    );

    expect(identityList[0]?.context.display).toEqual({
      branch: null,
      label: null,
    });
    expect(identityList[1]?.context.display).toEqual({
      branch: null,
      label: null,
    });
    expect(identityList[0]?.context.instanceId).toBe(
      identityList[1]?.context.instanceId,
    );
  });

  it("preserves exact display boundaries", async () => {
    const label = "a".repeat(120);
    const branch = "b".repeat(256);
    const path = `/work/${label}`;

    await expect(
      resolveWorkspace({
        runtime: createRuntime({
          currentDirectory: path,
          git: async ({ argumentList }) =>
            argumentList[0] === "rev-parse" ? path : branch,
        }).runtime,
      }),
    ).resolves.toMatchObject({
      context: { display: { branch, label } },
    });
  });

  it("uses native Windows path semantics", async () => {
    const { runtime } = createRuntime({
      currentDirectory: "C:\\Work\\Project\\src",
      git: async ({ argumentList }) =>
        argumentList[0] === "rev-parse" ? "C:\\Work\\Project" : null,
      platform: "win32",
    });

    await expect(resolveWorkspace({ runtime })).resolves.toMatchObject({
      context: { display: { branch: null, label: "Project" } },
      path: "c:/work/project",
      platform: "win32",
    });
  });

  it("propagates selected-directory canonicalization failure", async () => {
    const { runtime } = createRuntime({
      canonicalize: async () => {
        throw new Error("Workspace directory is unavailable.");
      },
    });

    await expect(resolveWorkspace({ runtime })).rejects.toThrow(
      "Workspace directory is unavailable.",
    );
  });
});
