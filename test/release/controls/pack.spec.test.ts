/**
 * @file Verify release packing with package manager environment values used in CI.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { packageManifest } from "../../../scripts/package/metadata.js";
import { executeTestCommand } from "../../process.js";

it.each([undefined, "pnpm", join("synthetic", "pnpm.exe")])(
  "creates an npm archive with npm_execpath=%j",
  { timeout: 30_000 },
  async (packageManagerPath) => {
    const directory = await mkdtemp(
      join(tmpdir(), "busy-octopus pack & %fixture%-"),
    );
    try {
      await writeFile(
        join(directory, "package.json"),
        JSON.stringify({
          name: packageManifest.name,
          version: packageManifest.version,
          private: true,
          files: ["payload.txt"],
        }),
      );
      await writeFile(
        join(directory, "payload.txt"),
        "synthetic package content\n",
      );
      await executeTestCommand({
        argumentList: [
          "--experimental-strip-types",
          fileURLToPath(
            new URL("../../../scripts/package/npm.ts", import.meta.url),
          ),
        ],
        command: process.execPath,
        directory,
        environment: { ...process.env, npm_execpath: packageManagerPath },
      });
      await expect(
        executeTestCommand({
          argumentList: [
            "--extract",
            "--gzip",
            "--to-stdout",
            "--file",
            join(
              directory,
              "artifacts",
              packageManifest.version,
              `${packageManifest.name}-${packageManifest.version}.tgz`,
            ),
            "package/payload.txt",
          ],
          command: "tar",
          directory,
        }),
      ).resolves.toBe("synthetic package content\n");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  },
);
