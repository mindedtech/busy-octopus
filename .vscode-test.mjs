/**
 * @file Configure real VS Code extension-host tests.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@vscode/test-cli";

const workspaceFolder = mkdtempSync(
  join(tmpdir(), "busy-octopus-extension-test-"),
);

process.once("exit", () => {
  rmSync(workspaceFolder, { force: true, recursive: true });
});

export default defineConfig({
  env: { ELECTRON_RUN_AS_NODE: undefined },
  extensionDevelopmentPath: ".",
  files: "dist/test/extension/**/*.e2e.test.cjs",
  launchArgs: [
    "--disable-extensions",
    "--disable-experiments",
    "--disable-gpu",
    "--disable-telemetry",
    "--sync=off",
    "--use-inmemory-secretstorage",
  ],
  mocha: {
    color: true,
    forbidOnly: true,
    timeout: 15_000,
    ui: "tdd",
  },
  version: "1.137.0",
  workspaceFolder,
});
