/**
 * @file VS Code extension archive creation from a clean generated manifest.
 */

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createVSIX } from "@vscode/vsce";
import {
  artifactDirectory,
  extensionArchivePath,
  packageManifest,
  repositoryDirectory,
} from "./metadata.ts";

const stageDirectory = join(artifactDirectory, "vsix-stage");

await mkdir(artifactDirectory, { recursive: true });
await rm(stageDirectory, { force: true, recursive: true });

try {
  await Promise.all([
    mkdir(join(stageDirectory, "dist", "extension"), { recursive: true }),
    mkdir(join(stageDirectory, "native"), { recursive: true }),
    mkdir(join(stageDirectory, "assets"), { recursive: true }),
  ]);

  await Promise.all([
    cp(
      join(repositoryDirectory, packageManifest.icon),
      join(stageDirectory, packageManifest.icon),
    ),
    cp(join(repositoryDirectory, "LICENSE"), join(stageDirectory, "LICENSE")),
    cp(
      join(repositoryDirectory, "CHANGELOG.md"),
      join(stageDirectory, "CHANGELOG.md"),
    ),
    cp(
      join(repositoryDirectory, "README.md"),
      join(stageDirectory, "README.md"),
    ),
    cp(
      join(repositoryDirectory, "native", "windows-notify.ps1"),
      join(stageDirectory, "native", "windows-notify.ps1"),
    ),
    cp(
      join(repositoryDirectory, "dist", "extension", "extension.cjs"),
      join(stageDirectory, "dist", "extension", "extension.cjs"),
    ),
    writeFile(
      join(stageDirectory, "package.json"),
      `${JSON.stringify(
        {
          ...packageManifest,
          files: [
            packageManifest.icon,
            "dist/extension/extension.cjs",
            "native/windows-notify.ps1",
            "CHANGELOG.md",
            "LICENSE",
            "README.md",
          ],
        } satisfies typeof packageManifest & { files: string[] },
        null,
        2,
      )}\n`,
    ),
  ]);

  await createVSIX({
    cwd: stageDirectory,
    dependencies: false,
    packagePath: extensionArchivePath,
    rewriteRelativeLinks: true,
    baseContentUrl: "https://github.com/mindedtech/busy-octopus/blob/main/",
  });
} finally {
  await rm(stageDirectory, { force: true, recursive: true });
}
