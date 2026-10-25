/**
 * @file Verify release tag rejection at checkout and signature boundaries.
 */

import { expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { verifyReleaseTag } from "../../../scripts/release/tag.js";

const commit = "1".repeat(40);
const tagSha = "2".repeat(40);
const alternativeSha = "3".repeat(40);
const tag = "v1.2.3";
const repository = "synthetic/project";

type TagVerification = Parameters<typeof verifyReleaseTag>[0];

const createFixture = () => {
  const gitResultMap = new Map<string, string | Error>([
    ["rev-parse HEAD", commit],
    [`cat-file -t refs/tags/${tag}`, "tag"],
    [`rev-parse refs/tags/${tag}^{commit}`, commit],
    [`merge-base --is-ancestor ${commit} origin/main`, ""],
    [`rev-parse refs/tags/${tag}`, tagSha],
  ]);
  const reference = { object: { sha: tagSha, type: "tag" } };
  const signature = {
    sha: tagSha,
    tag,
    object: { sha: commit, type: "commit" },
    verification: { verified: true },
  };
  const executeGit = vi.fn<TagVerification["executeGit"]>(
    async (argumentList) => {
      const result = gitResultMap.get(argumentList.join(" "));
      if (result === undefined) {
        throw new Error("Unexpected Git operation.");
      }
      if (result instanceof Error) {
        throw result;
      }
      return result;
    },
  );
  const readGitHubJson = vi.fn<TagVerification["readGitHubJson"]>(
    async (path) => {
      if (path === `/repos/${repository}/git/ref/tags/${tag}`) {
        return reference;
      }
      if (path === `/repos/${repository}/git/tags/${tagSha}`) {
        return signature;
      }
      throw new Error("Unexpected GitHub operation.");
    },
  );

  return {
    gitResultMap,
    reference,
    signature,
    verify: () =>
      verifyReleaseTag({ commit, tag, repository, executeGit, readGitHubJson }),
  };
};

it("accepts one signed tag targeting the workflow checkout on main", async () => {
  await expect(createFixture().verify()).resolves.toBe(tagSha);
});

it.each([
  [
    "rev-parse HEAD",
    alternativeSha,
    "The checkout must match the workflow commit.",
  ],
  [
    `cat-file -t refs/tags/${tag}`,
    "commit",
    "Publication requires an annotated tag.",
  ],
  [
    `rev-parse refs/tags/${tag}^{commit}`,
    alternativeSha,
    "The release tag must target the workflow commit.",
  ],
])("rejects inconsistent local state: %s", async (command, result, message) => {
  const { gitResultMap, verify } = createFixture();
  gitResultMap.set(command, result);
  await expect(verify()).rejects.toThrow(message);
});

it("rejects a checkout outside main history", async () => {
  const { gitResultMap, verify } = createFixture();
  gitResultMap.set(
    `merge-base --is-ancestor ${commit} origin/main`,
    new Error("Synthetic merge-base failure."),
  );
  await expect(verify()).rejects.toThrow("Synthetic merge-base failure.");
});

it("rejects a remote tag move", async () => {
  const { reference, verify } = createFixture();
  reference.object.sha = alternativeSha;
  await expect(verify()).rejects.toThrow("remote release tag has changed");
});

it("rejects a signature for another tag object", async () => {
  const { signature, verify } = createFixture();
  signature.sha = alternativeSha;
  await expect(verify()).rejects.toThrow("signature must belong");
});

it("rejects a signed tag targeting another commit", async () => {
  const { signature, verify } = createFixture();
  signature.object.sha = alternativeSha;
  await expect(verify()).rejects.toThrow("signed tag must target");
});

it("rejects a signed tag with a different name", async () => {
  const { signature, verify } = createFixture();
  signature.tag = "v1.2.4";
  await expect(verify()).rejects.toThrow("signed tag name must match");
});

it("rejects an unverified signature", async () => {
  const { signature, verify } = createFixture();
  signature.verification.verified = false;
  await expect(verify()).rejects.toThrow(ZodError);
});
