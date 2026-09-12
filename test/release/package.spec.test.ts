/**
 * @file Verify npm installation of the release package archive.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { z } from "zod";
import {
  packageArchivePath,
  packageManifest,
} from "../../scripts/package/metadata.js";
import { executeNpm, executeTestCommand } from "../process.js";

const InstalledPackage = z.object({
  name: z.literal(packageManifest.name),
  version: z.literal(packageManifest.version),
});

it("installs and runs with npm", { timeout: 60_000 }, async () => {
  const fixtureDirectory = await mkdtemp(join(tmpdir(), "busy-octopus-npm-"));
  const cacheDirectory = join(fixtureDirectory, "npm-cache");
  const workspaceDirectory = join(fixtureDirectory, "workspace");
  const runtimeDirectory = join(fixtureDirectory, "runtime");

  try {
    await Promise.all([
      mkdir(runtimeDirectory),
      mkdir(workspaceDirectory),
      writeFile(
        join(fixtureDirectory, "package.json"),
        JSON.stringify({
          name: "busy-octopus-npm-fixture",
          private: true,
          type: "module",
        }),
      ),
    ]);

    const environment = {
      ...process.env,
      npm_config_cache: cacheDirectory,
      TEMP: runtimeDirectory,
      TMP: runtimeDirectory,
      TMPDIR: runtimeDirectory,
    };

    await executeNpm({
      argumentList: [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        packageArchivePath,
      ],
      directory: fixtureDirectory,
      environment,
    });

    expect(
      InstalledPackage.parse(
        JSON.parse(
          await readFile(
            join(
              fixtureDirectory,
              "node_modules",
              packageManifest.name,
              "package.json",
            ),
            "utf8",
          ),
        ),
      ),
    ).toEqual({
      name: packageManifest.name,
      version: packageManifest.version,
    } satisfies z.infer<typeof InstalledPackage>);

    const help = await executeNpm({
      argumentList: ["exec", "--", "busy-octopus", "--help"],
      directory: fixtureDirectory,
      environment,
    });

    expect(help).toContain("Usage: busy-octopus");

    const cliVersion = await executeNpm({
      argumentList: ["exec", "--", "busy-octopus", "--version"],
      directory: fixtureDirectory,
      environment,
    });

    expect(cliVersion).toBe(`${packageManifest.version}\n`);

    const consumerPath = join(fixtureDirectory, "consumer.mjs");
    await writeFile(
      consumerPath,
      `import { notify } from "busy-octopus";

let deepImportError;
try {
  await import("busy-octopus/dist/queue/queue.js");
} catch (error) {
  deepImportError = error;
}
if (deepImportError?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") {
  throw new Error("Internal package paths are available.");
}

const result = await notify({
  body: null,
  directory: process.argv[2],
  notificationId: "npm-release-notification",
  source: null,
  title: "npm release test",
});
process.stdout.write(result.notificationId);
`,
    );

    await expect(
      executeTestCommand({
        argumentList: [consumerPath, workspaceDirectory],
        command: process.execPath,
        directory: fixtureDirectory,
        environment,
      }),
    ).resolves.toBe("npm-release-notification");

    const typeConsumerPath = join(fixtureDirectory, "consumer.ts");
    await writeFile(
      typeConsumerPath,
      `import { notify, type NotifyInput } from "busy-octopus";

const input: NotifyInput = {
  body: null,
  source: null,
  title: "npm release type test",
};
void notify(input);
`,
    );

    await executeTestCommand({
      argumentList: [
        join(process.cwd(), "node_modules", "typescript", "bin", "tsc"),
        "--noEmit",
        "--strict",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--target",
        "ES2023",
        typeConsumerPath,
      ],
      command: process.execPath,
      directory: fixtureDirectory,
    });
  } finally {
    await rm(fixtureDirectory, { force: true, recursive: true });
  }
});
