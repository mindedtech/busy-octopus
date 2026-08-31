/**
 * @file Create the VS Code extension archive from a clean generated manifest.
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

await rm(stageDirectory, { force: true, recursive: true });
await mkdir(join(stageDirectory, "dist", "extension"), { recursive: true });

await Promise.all([
  cp(join(repositoryDirectory, "LICENSE"), join(stageDirectory, "LICENSE")),
  cp(join(repositoryDirectory, "README.md"), join(stageDirectory, "README.md")),
  cp(
    join(repositoryDirectory, "dist", "extension", "extension.cjs"),
    join(stageDirectory, "dist", "extension", "extension.cjs"),
  ),
  writeFile(
    join(stageDirectory, "package.json"),
    `${JSON.stringify({ ...manifest, files: ["dist/extension/extension.cjs", "LICENSE", "README.md"] }, null, 2)}\n`,
  ),
]);

await mkdir(artifactDirectory, { recursive: true });

await createVSIX({
  cwd: stageDirectory,
  dependencies: false,
  packagePath: join(artifactDirectory, "busy-octopus-0.0.0.vsix"),
  rewriteRelativeLinks: false,
});
