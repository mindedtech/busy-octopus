/**
 * @file Verify release tag rejection at checkout and signature boundaries.
 */

import { expect, it, vi } from "vitest";
import { verifyReleaseTag } from "../../../scripts/release/tag.js";

const commit = "1".repeat(40);
const tagSha = "2".repeat(40);
const alternativeSha = "3".repeat(40);
const tag = "v1.2.3";
const repository = "synthetic/project";

const createFixture = () => {
  const gitResultMap = new Map([
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
  const executeGit = vi.fn(async (argumentList: string[]) => {
    const result = gitResultMap.get(argumentList.join(" "));
    if (result === undefined) {
      throw new Error("Unexpected Git operation.");
    }
    return result;
  });
  const readGitHubJson = vi.fn(async (path: string) => {
    if (path === `/repos/${repository}/git/ref/tags/${tag}`) {
      return reference;
    }
    if (path === `/repos/${repository}/git/tags/${tagSha}`) {
      return signature;
    }
    throw new Error("Unexpected GitHub operation.");
  });

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
  ["rev-parse HEAD", alternativeSha],
  [`cat-file -t refs/tags/${tag}`, "commit"],
  [`rev-parse refs/tags/${tag}^{commit}`, alternativeSha],
])("rejects inconsistent local state: %s", async (command, result) => {
  const { gitResultMap, verify } = createFixture();
  gitResultMap.set(command, result);
  await expect(verify()).rejects.toThrow();
});

it("rejects a checkout outside main history", async () => {
  const { gitResultMap, verify } = createFixture();
  gitResultMap.delete(`merge-base --is-ancestor ${commit} origin/main`);
  await expect(verify()).rejects.toThrow();
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
  await expect(verify()).rejects.toThrow();
});
