/**
 * @file VS Code extension archive creation from a clean generated manifest.
 */

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createVSIX } from "@vscode/vsce";
import { z } from "zod";
import packageJson from "../../package.json" with { type: "json" };

/**
 * @see https://code.visualstudio.com/api/references/extension-manifest
 */
const ExtensionPackage = z.object({
  activationEvents: z.array(z.string()),
  capabilities: z.object({
    untrustedWorkspaces: z.object({ supported: z.boolean() }),
    virtualWorkspaces: z.object({ supported: z.boolean() }),
  }),
  categories: z.array(z.string()),
  contributes: z.object({
    commands: z.array(
      z.object({
        category: z.string(),
        command: z.string(),
        title: z.string(),
      }),
    ),
    configuration: z.object({
      properties: z.record(
        z.string(),
        z.object({
          default: z.boolean(),
          description: z.string(),
          type: z.literal("boolean"),
        }),
      ),
      title: z.string(),
    }),
  }),
  description: z.string(),
  displayName: z.string(),
  engines: z.object({ vscode: z.string() }),
  extensionKind: z.array(z.string()),
  license: z.string(),
  main: z.string(),
  name: z.string(),
  publisher: z.string(),
  repository: z.object({ type: z.string(), url: z.string() }),
  version: z.string(),
});

const repositoryDirectory = process.cwd();
const artifactDirectory = join(repositoryDirectory, "artifacts");
const stageDirectory = join(artifactDirectory, "vsix-stage");

const manifest = ExtensionPackage.parse(packageJson);
const artifactPath = join(
  artifactDirectory,
  `${manifest.name}-${manifest.version}.vsix`,
);

await rm(stageDirectory, { force: true, recursive: true });
await Promise.all([
  mkdir(join(stageDirectory, "dist", "extension"), { recursive: true }),
  mkdir(join(stageDirectory, "native"), { recursive: true }),
]);

await Promise.all([
  cp(join(repositoryDirectory, "LICENSE"), join(stageDirectory, "LICENSE")),
  cp(join(repositoryDirectory, "README.md"), join(stageDirectory, "README.md")),
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
        ...manifest,
        files: [
          "dist/extension/extension.cjs",
          "native/windows-notify.ps1",
          "LICENSE",
          "README.md",
        ],
      } satisfies typeof manifest & { files: string[] },
      null,
      2,
    )}\n`,
  ),
]);

await mkdir(artifactDirectory, { recursive: true });

await createVSIX({
  cwd: stageDirectory,
  dependencies: false,
  packagePath: artifactPath,
  rewriteRelativeLinks: false,
});
