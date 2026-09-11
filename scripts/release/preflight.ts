/**
 * @file Reject publication until the release tag and controls are ready.
 */

import { ok, strictEqual } from "node:assert/strict";
import { execFile } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { promisify } from "node:util";
import { z } from "zod";
import { packageManifest, publicationEnabled } from "../package/metadata.ts";
import { verifyReleaseTag } from "./tag.ts";

const execFileAsync = promisify(execFile);

const ReleaseEnvironment = z.object({
  GITHUB_REF_NAME: z.string().min(1).max(128),
  GITHUB_SHA: z.string().regex(/^[\da-f]{40}$/u),
  GITHUB_OUTPUT: z.string().min(1),
  GITHUB_REF_TYPE: z.literal("tag"),
  GITHUB_REPOSITORY: z.literal("mindedtech/busy-octopus"),
  GITHUB_TOKEN: z.string().min(1),
  RELEASE_ENABLED: z.literal("true"),
});
ok(publicationEnabled, "Publication requires a public package.");
ok(
  packageManifest.version !== "0.0.0",
  "Publication requires a release version.",
);

const releaseEnvironment = ReleaseEnvironment.parse(process.env);
const releaseTag = `v${packageManifest.version}`;

strictEqual(
  releaseEnvironment.GITHUB_REF_NAME,
  releaseTag,
  `Publication requires the ${releaseTag} tag.`,
);

const executeGit = async (argumentList: string[]): Promise<string> => {
  const { stdout } = await execFileAsync("git", argumentList, {
    encoding: "utf8",
    maxBuffer: 1_048_576,
    timeout: 10_000,
    windowsHide: true,
  });

  return stdout.trim();
};

const readGitHubJson = async (path: string): Promise<unknown> => {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${releaseEnvironment.GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(10_000),
  });

  ok(response.ok, `GitHub returned status ${response.status}.`);

  ok(response.body !== null, "GitHub returned an empty response.");
  const reader = response.body.getReader();
  const chunkList: Uint8Array[] = [];
  let byteCount = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      byteCount += value.byteLength;
      ok(
        byteCount <= 1_048_576,
        "GitHub response exceeds the release metadata limit.",
      );
      chunkList.push(value);
    }
  } finally {
    try {
      await reader.cancel();
    } finally {
      reader.releaseLock();
    }
  }

  return JSON.parse(Buffer.concat(chunkList).toString("utf8"));
};

const tagSha = await verifyReleaseTag({
  commit: releaseEnvironment.GITHUB_SHA,
  tag: releaseTag,
  repository: releaseEnvironment.GITHUB_REPOSITORY,
  executeGit,
  readGitHubJson,
});

await appendFile(releaseEnvironment.GITHUB_OUTPUT, `tag-sha=${tagSha}\n`);
