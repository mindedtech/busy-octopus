/**
 * @file Bind release authorization to one signed tag and checkout commit.
 */

import { strictEqual } from "node:assert/strict";
import { z } from "zod";

const GitSha = z.string().regex(/^[\da-f]{40}$/u);
// GitHub adds response metadata independently; retain only the release contract.
const GitReference = z.object({
  object: z.object({ sha: GitSha, type: z.literal("tag") }),
});
const GitTag = z.object({
  sha: GitSha,
  tag: z.string().min(1).max(128),
  object: z.object({ sha: GitSha, type: z.literal("commit") }),
  verification: z.object({ verified: z.literal(true) }),
});

/**
 * Verify that the checkout, local tag, and GitHub signature identify one release.
 *
 * @returns Immutable tag object identifier for subsequent publication checks.
 */
export const verifyReleaseTag = async ({
  commit,
  tag,
  repository,
  executeGit,
  readGitHubJson,
}: {
  commit: string;
  tag: string;
  repository: string;
  executeGit: (argumentList: string[]) => Promise<string>;
  readGitHubJson: (path: string) => Promise<unknown>;
}): Promise<string> => {
  strictEqual(
    await executeGit(["rev-parse", "HEAD"]),
    commit,
    "The checkout must match the workflow commit.",
  );
  strictEqual(
    await executeGit(["cat-file", "-t", `refs/tags/${tag}`]),
    "tag",
    "Publication requires an annotated tag.",
  );
  strictEqual(
    await executeGit(["rev-parse", `refs/tags/${tag}^{commit}`]),
    commit,
    "The release tag must target the workflow commit.",
  );
  await executeGit(["merge-base", "--is-ancestor", commit, "origin/main"]);

  const tagSha = GitSha.parse(
    await executeGit(["rev-parse", `refs/tags/${tag}`]),
  );
  const {
    object: { sha: referenceSha },
  } = GitReference.parse(
    await readGitHubJson(`/repos/${repository}/git/ref/tags/${tag}`),
  );
  strictEqual(referenceSha, tagSha, "The remote release tag has changed.");

  const {
    sha,
    tag: tagName,
    object: { sha: target },
  } = GitTag.parse(
    await readGitHubJson(`/repos/${repository}/git/tags/${tagSha}`),
  );
  strictEqual(
    sha,
    tagSha,
    "The signature must belong to the release tag object.",
  );
  strictEqual(tagName, tag, "The signed tag name must match the release.");
  strictEqual(
    target,
    commit,
    "The signed tag must target the workflow commit.",
  );

  return tagSha;
};
