/**
 * @file Verify installation and activation of the release VSIX.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  extensionArchivePath,
  packageManifest,
  repositoryDirectory,
} from "../../scripts/package/metadata.js";
import { executeVsCodeCli } from "../vscode.js";

const extensionId = `${packageManifest.publisher}.${packageManifest.name}`;
const extensionVersion = `${extensionId}@${packageManifest.version}`;
const vscodeVersion = packageManifest.engines.vscode.slice(1);

let fixtureDirectory = "";
let vscodeExecutablePath = "";

beforeAll(async () => {
  fixtureDirectory = await mkdtemp(join(tmpdir(), "bo-vsix-"));
  vscodeExecutablePath = await downloadAndUnzipVSCode(vscodeVersion);
}, 120_000);

afterAll(async () => {
  await rm(fixtureDirectory, { force: true, recursive: true });
});

const vscodeEnvironment = {
  ...process.env,
  DONT_PROMPT_WSL_INSTALL: "1",
  VSCODE_IPC_HOOK_CLI: undefined,
};

it("installs, activates, disables, reinstalls, and uninstalls", {
  timeout: 120_000,
}, async () => {
  const extensionDirectory = join(fixtureDirectory, "extensions");
  const profileDirectory = join(fixtureDirectory, "profile");
  const probeDirectory = join(fixtureDirectory, "probe");
  const workspaceDirectory = join(fixtureDirectory, "workspace");
  const testRunnerPath = join(probeDirectory, "test.cjs");
  const profileArgumentList = [
    `--extensions-dir=${extensionDirectory}`,
    `--user-data-dir=${profileDirectory}`,
  ];
  await Promise.all([
    mkdir(extensionDirectory),
    mkdir(profileDirectory),
    mkdir(probeDirectory),
    mkdir(workspaceDirectory),
  ]);

  await Promise.all([
    writeFile(
      join(probeDirectory, "package.json"),
      JSON.stringify({
        activationEvents: [],
        engines: { vscode: packageManifest.engines.vscode },
        main: "extension.cjs",
        name: "busy-octopus-release-probe",
        publisher: "mindedtech",
        version: "0.0.0",
      }),
    ),
    writeFile(
      join(probeDirectory, "extension.cjs"),
      "exports.activate = () => undefined;\n",
    ),
    writeFile(
      testRunnerPath,
      `const vscode = require("vscode");

exports.run = async () => {
  const extension = vscode.extensions.getExtension(${JSON.stringify(extensionId)});
  const activationExpected = process.env.BUSY_OCTOPUS_ACTIVATION_EXPECTED === "1";

  if (extension === undefined && activationExpected) {
    throw new Error("Installed Busy Octopus extension is unavailable.");
  }

  if (extension === undefined) {
    return;
  }

  if (activationExpected) {
    await extension.activate();
  }

  if (extension.isActive !== activationExpected) {
    throw new Error("Busy Octopus extension activation state is incorrect.");
  }
};
`,
    ),
  ]);

  const runCli = (argumentList: string[]) =>
    executeVsCodeCli({
      argumentList: [...profileArgumentList, ...argumentList],
      executablePath: vscodeExecutablePath,
      directory: repositoryDirectory,
      environment: vscodeEnvironment,
    });

  await runCli(["--install-extension", extensionArchivePath]);

  expect(
    (await runCli(["--list-extensions", "--show-versions"]))
      .trim()
      .split(/\r?\n/u),
  ).toContain(extensionVersion);

  await runTests({
    extensionDevelopmentPath: probeDirectory,
    extensionTestsEnv: {
      BUSY_OCTOPUS_ACTIVATION_EXPECTED: "1",
      ELECTRON_RUN_AS_NODE: undefined,
      VSCODE_IPC_HOOK_CLI: undefined,
    },
    extensionTestsPath: testRunnerPath,
    launchArgs: [
      workspaceDirectory,
      ...profileArgumentList,
      "--disable-telemetry",
    ],
    vscodeExecutablePath,
  });
  await runTests({
    extensionDevelopmentPath: probeDirectory,
    extensionTestsEnv: {
      BUSY_OCTOPUS_ACTIVATION_EXPECTED: "0",
      ELECTRON_RUN_AS_NODE: undefined,
      VSCODE_IPC_HOOK_CLI: undefined,
    },
    extensionTestsPath: testRunnerPath,
    launchArgs: [
      workspaceDirectory,
      ...profileArgumentList,
      "--disable-extension",
      extensionId,
      "--disable-telemetry",
    ],
    vscodeExecutablePath,
  });

  await runCli(["--install-extension", extensionArchivePath, "--force"]);
  expect(
    (await runCli(["--list-extensions", "--show-versions"]))
      .trim()
      .split(/\r?\n/u),
  ).toContain(extensionVersion);

  await runCli(["--uninstall-extension", extensionId]);
  expect(
    (await runCli(["--list-extensions", "--show-versions"]))
      .trim()
      .split(/\r?\n/u),
  ).not.toContain(extensionVersion);
});
