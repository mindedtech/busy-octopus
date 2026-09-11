/**
 * @file Read package metadata and release artifact paths.
 */

import { join } from "node:path";
import { z } from "zod";
import packageJson from "../../package.json" with { type: "json" };

/**
 * @see https://code.visualstudio.com/api/references/extension-manifest
 */
const PackageJson = z.object({
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
  name: z.literal("busy-octopus"),
  private: z.boolean().optional(),
  publisher: z.literal("mindedtech"),
  repository: z.object({ type: z.string(), url: z.string() }),
  version: z.string().regex(/^\d+\.\d+\.\d+$/u),
});

const { private: packagePrivate, ...packageManifest } =
  PackageJson.parse(packageJson);

export { packageManifest };
export const publicationEnabled = packagePrivate !== true;
export const repositoryDirectory = process.cwd();
export const artifactDirectory = join(
  repositoryDirectory,
  "artifacts",
  packageManifest.version,
);
export const packageArchivePath = join(
  artifactDirectory,
  `${packageManifest.name}-${packageManifest.version}.tgz`,
);
export const extensionArchivePath = join(
  artifactDirectory,
  `${packageManifest.name}-${packageManifest.version}.vsix`,
);
export const checksumPath = join(artifactDirectory, "SHA256SUMS");
