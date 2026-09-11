/**
 * @file Verify the complete release artifact set and its checksums.
 */

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { unzipSync } from "fflate";
import { expect, it } from "vitest";
import { z } from "zod";
import {
  artifactDirectory,
  checksumPath,
  extensionArchivePath,
  packageArchivePath,
  packageManifest,
} from "../../scripts/package/metadata.js";
import { extensionFileList, packageFileList } from "../package/contents.js";
import { executeTestCommand } from "../process.js";

const packageArchiveName = basename(packageArchivePath);
const extensionArchiveName = basename(extensionArchivePath);
const artifactNameList = [
  basename(checksumPath),
  packageArchiveName,
  extensionArchiveName,
].toSorted();

it("contains only the release archives and checksum file", async () => {
  expect((await readdir(artifactDirectory)).toSorted()).toEqual(
    artifactNameList,
  );
});

it("contains valid SHA-256 checksums for both archives", async () => {
  const checksumText = await readFile(checksumPath, "utf8");
  const entryList = checksumText
    .trimEnd()
    .split("\n")
    .map((line) => {
      const match = /^([\da-f]{64}) {2}([^/\\]+)$/u.exec(line);
      const checksum = match?.[1];
      const name = match?.[2];

      if (checksum === undefined || name === undefined) {
        throw new Error("Invalid SHA-256 checksum entry.");
      }

      return { checksum, name };
    });

  expect(entryList.map(({ name }) => name)).toEqual(
    [packageArchiveName, extensionArchiveName].toSorted(),
  );
  expect(new Set(entryList.map(({ name }) => name)).size).toBe(
    entryList.length,
  );

  for (const { checksum, name } of entryList) {
    expect(
      createHash("sha256")
        .update(await readFile(join(artifactDirectory, name)))
        .digest("hex"),
    ).toBe(checksum);
  }
});

it("uses the source identity in the extension manifest", async () => {
  const extensionArchive = unzipSync(
    new Uint8Array(await readFile(extensionArchivePath)),
  );
  const extensionManifest = z
    .object({
      name: z.literal(packageManifest.name),
      publisher: z.literal(packageManifest.publisher),
      version: z.literal(packageManifest.version),
    })
    .parse(
      JSON.parse(
        new TextDecoder().decode(extensionArchive["extension/package.json"]),
      ),
    );

  expect(extensionManifest).toEqual({
    name: packageManifest.name,
    publisher: packageManifest.publisher,
    version: packageManifest.version,
  } satisfies typeof extensionManifest);
});

it("contains only allowed files inside the final npm archive", async () => {
  const listing = await executeTestCommand({
    argumentList: ["--list", "--gzip", "--file", packageArchivePath],
    command: "tar",
    directory: artifactDirectory,
  });

  expect(listing.trimEnd().split(/\r?\n/u).toSorted()).toEqual(
    packageFileList.map((path) => `package/${path}`).toSorted(),
  );
});

it("contains only allowed files inside the final VSIX", async () => {
  const archive = unzipSync(
    new Uint8Array(await readFile(extensionArchivePath)),
  );

  expect(Object.keys(archive).toSorted()).toEqual(extensionFileList.toSorted());
  expect(new TextDecoder().decode(archive["extension/readme.md"])).toContain(
    "https://github.com/mindedtech/busy-octopus/blob/main/docs/PRIVACY.md",
  );
  expect(new TextDecoder().decode(archive["extension/changelog.md"])).toBe(
    await readFile("CHANGELOG.md", "utf8"),
  );
});
