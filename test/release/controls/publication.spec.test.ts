/**
 * @file Verify publication order and bounded registry confirmation without network access.
 */

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, assert, describe, expect, it } from "vitest";
import { executeTestCommand } from "../../process.js";

const workflow = await readFile(".github/workflows/publish.yml", "utf8");
const npmVersion = workflow.match(/^ {6}NPM_VERSION: (\d+\.\d+\.\d+)$/mu)?.[1];
const directoryList: string[] = [];
const version = "1.2.3";
const archive = "synthetic release archive";
const integrity = `sha512-${createHash("sha512").update(archive).digest("base64")}`;

const readStep = (name: string): string => {
  const block = workflow
    .split(`      - name: ${name}\n`)[1]
    ?.split("\n      - name:")[0];
  const script = block?.match(/^ {8}run: \|\n((?: {10}.*\n|\n)*)/m)?.[1];
  if (script !== undefined) {
    return script.replace(/^ {10}/gm, "");
  }
  const command = block?.match(/^ {8}run: (.+)$/m)?.[1];
  assert.isDefined(command);
  return command;
};

const createFixture = async ({
  response,
  failureCount = 0,
  httpStatus = 200,
  downloadFailure = false,
  downloadArchive = archive,
  uploadFailure = false,
}: {
  response: unknown;
  failureCount?: number;
  httpStatus?: number;
  downloadFailure?: boolean;
  downloadArchive?: string;
  uploadFailure?: boolean;
}) => {
  const directory = await mkdtemp(join(tmpdir(), "publication-test-"));
  directoryList.push(directory);
  await mkdir(join(directory, "artifacts"));
  await writeFile(
    join(directory, "artifacts", `busy-octopus-${version}.tgz`),
    archive,
  );
  await writeFile(
    join(directory, "artifacts", `busy-octopus-${version}.vsix`),
    archive,
  );
  await writeFile(join(directory, "download.vsix"), downloadArchive);
  await writeFile(join(directory, "http-status"), String(httpStatus));
  await writeFile(join(directory, "upload-count"), "0");
  await writeFile(join(directory, "output"), "");
  await writeFile(
    join(directory, "npm-version.json"),
    JSON.stringify({
      name: "busy-octopus",
      version,
      dist: { integrity },
    }),
  );
  await writeFile(join(directory, "response.json"), JSON.stringify(response));
  await writeFile(join(directory, "count"), "0");
  const counter = `count=$(cat "$MOCK_COUNT_FILE")
  echo "$((count + 1))" > "$MOCK_COUNT_FILE"
  if (( count < MOCK_FAILURE_COUNT )); then exit 1; fi
`;
  await writeFile(
    join(directory, "npm"),
    `#!/bin/bash
if [[ "$1" == publish ]]; then
  count=$(cat "$MOCK_UPLOAD_COUNT_FILE")
  echo "$((count + 1))" > "$MOCK_UPLOAD_COUNT_FILE"
  cp "$MOCK_NPM_VERSION_FILE" "$MOCK_RESPONSE_FILE"
  echo 200 > "$MOCK_STATUS_FILE"
  if [[ "$MOCK_UPLOAD_FAILURE" == 1 ]]; then exit 1; fi
  exit 0
fi
${counter}cat "$MOCK_RESPONSE_FILE"
`,
    { mode: 0o700 },
  );
  await writeFile(
    join(directory, "pnpm"),
    `#!/bin/bash
if [[ "$1" == --silent ]]; then shift; fi
if [[ "$1" != dlx || "$2" != "npm@$NPM_VERSION" ]]; then exit 1; fi
shift 2
exec npm "$@"
`,
    { mode: 0o700 },
  );
  await writeFile(
    join(directory, "curl"),
    `#!/bin/bash
${counter}
output=""
status_output=0
download=0
fail=0
for argument in "$@"; do
  if [[ "$argument" == */vspackage ]]; then download=1; fi
  if [[ "$argument" == --fail ]]; then fail=1; fi
done
while [[ "$#" -gt 0 ]]; do
  if [[ "$1" == --output ]]; then output="$2"; fi
  if [[ "$1" == --write-out ]]; then status_output=1; fi
  shift
done
if [[ "$download" == 1 ]]; then
  if [[ "$MOCK_DOWNLOAD_FAILURE" == 1 ]]; then exit 22; fi
  cp "$MOCK_DOWNLOAD_FILE" "$output"
  exit 0
fi
status=$(cat "$MOCK_STATUS_FILE")
if [[ "$fail" == 1 && "$status" != 200 ]]; then exit 22; fi
cp "$MOCK_RESPONSE_FILE" "$output"
if [[ "$status_output" == 1 ]]; then printf '%s' "$status"; fi
`,
    { mode: 0o700 },
  );
  await writeFile(join(directory, "sleep"), "#!/bin/bash\nexit 0\n", {
    mode: 0o700,
  });

  return {
    run: (name: string, environment: NodeJS.ProcessEnv = {}) =>
      executeTestCommand({
        argumentList: ["-c", readStep(name)],
        command: "bash",
        directory,
        environment: {
          ...process.env,
          PATH: `${directory}${delimiter}${process.env.PATH}`,
          RELEASE_VERSION: version,
          NPM_VERSION: npmVersion,
          MOCK_COUNT_FILE: join(directory, "count"),
          MOCK_RESPONSE_FILE: join(directory, "response.json"),
          MOCK_FAILURE_COUNT: String(failureCount),
          MOCK_STATUS_FILE: join(directory, "http-status"),
          MOCK_UPLOAD_COUNT_FILE: join(directory, "upload-count"),
          MOCK_NPM_VERSION_FILE: join(directory, "npm-version.json"),
          MOCK_DOWNLOAD_FILE: join(directory, "download.vsix"),
          MOCK_DOWNLOAD_FAILURE: downloadFailure ? "1" : "0",
          MOCK_UPLOAD_FAILURE: uploadFailure ? "1" : "0",
          GITHUB_OUTPUT: join(directory, "output"),
          ...environment,
        },
        timeoutMilliseconds: 5_000,
      }),
    count: async () => Number(await readFile(join(directory, "count"), "utf8")),
    uploadCount: async () =>
      Number(await readFile(join(directory, "upload-count"), "utf8")),
    output: async () => readFile(join(directory, "output"), "utf8"),
  };
};

const marketplaceResponse = (
  releaseVersion: string,
  publisher = "mindedtech",
  flags = "validated, public",
) => ({
  results: [
    {
      extensions: [
        {
          publisher: { publisherName: publisher },
          extensionName: "busy-octopus",
          flags,
          versions: [{ version: releaseVersion }],
        },
      ],
    },
  ],
});

afterEach(async () => {
  await Promise.all(
    directoryList
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

it("orders publishers and keeps downloads bound to the original artifact", () => {
  expect(workflow).toContain(
    "name: VS Code Marketplace\n    needs: [npm, package, preflight]",
  );
  expect(workflow).toContain(
    "name: GitHub\n    needs: [marketplace, npm, package, preflight]",
  );
  expect(
    workflow.match(
      /artifact-ids: \$\{\{ needs.package.outputs.artifact-id \}\}/g,
    ),
  ).toHaveLength(3);
  expect(workflow).toMatch(
    /artifact-id: \$\{\{ steps.artifact.outputs.artifact-id \}\}/,
  );
  expect(workflow.indexOf("name: Confirm npm publication")).toBeLessThan(
    workflow.indexOf("name: Publish VS Code extension"),
  );
  expect(
    workflow.indexOf("name: Confirm Marketplace publication"),
  ).toBeLessThan(workflow.indexOf("name: Create GitHub release"));
});

it("uses one pinned npm CLI for its check and publication", () => {
  expect(npmVersion).toMatch(/^\d+\.\d+\.\d+$/u);
  expect(workflow).toContain(
    'test "$(pnpm --silent dlx "npm@$NPM_VERSION" --version)" = "$NPM_VERSION"',
  );
  expect(workflow).toContain('pnpm dlx "npm@$NPM_VERSION" publish');
});

// Publication jobs run only on Ubuntu; these tests execute their Bash steps.
describe.skipIf(process.platform !== "linux")("registry confirmation", () => {
  it.each([0, 2])(
    "accepts matching npm bytes after %i transient failures",
    async (failureCount) => {
      const fixture = await createFixture({
        response: integrity,
        failureCount,
      });
      await expect(fixture.run("Confirm npm publication")).resolves.toBe("");
      expect(await fixture.count()).toBe(failureCount + 1);
    },
  );

  it("rejects a conflicting npm archive immediately", async () => {
    const fixture = await createFixture({ response: "sha512-other" });
    await expect(fixture.run("Confirm npm publication")).rejects.toThrow(
      "does not match the approved archive",
    );
    expect(await fixture.count()).toBe(1);
  });

  it("stops after six unavailable npm responses", async () => {
    const fixture = await createFixture({ response: null, failureCount: 10 });
    await expect(fixture.run("Confirm npm publication")).rejects.toThrow(
      "Cannot confirm npm publication",
    );
    expect(await fixture.count()).toBe(6);
  });

  it.each([null, {}])(
    "rejects malformed npm integrity %j",
    async (response) => {
      const fixture = await createFixture({ response });
      await expect(fixture.run("Confirm npm publication")).rejects.toThrow(
        "Cannot confirm npm publication",
      );
    },
  );

  it.each([0, 2])(
    "accepts the exact Marketplace version after %i transient failures",
    async (failureCount) => {
      const fixture = await createFixture({
        response: marketplaceResponse(version),
        failureCount,
      });
      await expect(
        fixture.run("Confirm Marketplace publication"),
      ).resolves.toBe("");
      expect(await fixture.count()).toBe(failureCount + 2);
    },
  );

  it.each([
    marketplaceResponse("9.9.9"),
    marketplaceResponse(version, "synthetic-other-publisher"),
    marketplaceResponse(
      version,
      "mindedtech",
      "validated, public, unpublished",
    ),
    marketplaceResponse(version, "mindedtech", "public"),
    marketplaceResponse(version, "mindedtech", "validated"),
    marketplaceResponse(version, "mindedtech", "validated, public, disabled"),
    marketplaceResponse(version, "mindedtech", "validated, public, locked"),
    { results: [{ extensions: [] }] },
    {},
  ])(
    "rejects missing or malformed Marketplace versions %j",
    async (response) => {
      const fixture = await createFixture({ response });
      await expect(
        fixture.run("Confirm Marketplace publication"),
      ).rejects.toThrow("Marketplace version is not visible");
      expect(await fixture.count()).toBe(61);
    },
  );
});

// Every retry executes these guards before any publishing action or credential exchange.
it.each(["npm", "marketplace", "release"])(
  "guards the %s job independently",
  (job) => {
    const block = workflow
      .split(`\n  ${job}:\n`)[1]
      ?.split(/\n {2}[a-z]+:\n/u)[0];
    assert.isDefined(block);
    expect(block).toMatch(
      /steps:\n {6}- name: Require publication authorization/u,
    );
    expect(block).toMatch(
      /RELEASE_ENABLED: \$\{\{ vars\.RELEASE_ENABLED \}\}/u,
    );
    expect(block).toContain('run: test "$RELEASE_ENABLED" = true');
  },
);

it("excludes unavailable Marketplace versions at the query boundary", () => {
  expect(workflow).toContain('"filterType":12,"value":"4096"');
  expect(workflow).toContain('"flags":33');
  expect(workflow).toContain("if: steps.marketplace.outputs.exists == 'false'");
});

describe.skipIf(process.platform !== "linux")("publication recovery", () => {
  it.each(["false", "", "TRUE"])(
    "rejects a disabled release switch %j",
    async (value) => {
      await expect(
        executeTestCommand({
          argumentList: ["-c", readStep("Require publication authorization")],
          command: "bash",
          directory: process.cwd(),
          environment: { RELEASE_ENABLED: value },
        }),
      ).rejects.toThrow();
    },
  );

  it("accepts the first npm archive without uploading it again", async () => {
    const fixture = await createFixture({
      response: { name: "busy-octopus", version, dist: { integrity } },
    });
    await expect(fixture.run("Publish npm package")).resolves.toContain(
      "already exists",
    );
    expect(await fixture.uploadCount()).toBe(0);
  });

  it("publishes an absent npm version", async () => {
    const fixture = await createFixture({ response: {}, httpStatus: 404 });
    await expect(fixture.run("Publish npm package")).resolves.toBe("");
    expect(await fixture.uploadCount()).toBe(1);
  });

  it("recovers an npm upload accepted before the command fails", async () => {
    const fixture = await createFixture({
      response: {},
      httpStatus: 404,
      uploadFailure: true,
    });
    await expect(fixture.run("Publish npm package")).rejects.toThrow();
    await expect(fixture.run("Publish npm package")).resolves.toContain(
      "already exists",
    );
    expect(await fixture.uploadCount()).toBe(1);
  });

  it.each([
    { name: "busy-octopus", version, dist: { integrity: "sha512-conflict" } },
    { name: "busy-octopus", version: "9.9.9", dist: { integrity } },
    {},
  ])("rejects conflicting or malformed npm metadata %j", async (response) => {
    const fixture = await createFixture({ response });
    await expect(fixture.run("Publish npm package")).rejects.toThrow(
      "does not match",
    );
    expect(await fixture.uploadCount()).toBe(0);
  });

  it.each([403, 429, 500])(
    "does not mistake npm HTTP %i for an absent version",
    async (httpStatus) => {
      const fixture = await createFixture({ response: {}, httpStatus });
      await expect(fixture.run("Publish npm package")).rejects.toThrow(
        "Cannot determine",
      );
      expect(await fixture.uploadCount()).toBe(0);
    },
  );

  it("does not publish when npm state cannot be fetched", async () => {
    const fixture = await createFixture({ response: {}, failureCount: 1 });
    await expect(fixture.run("Publish npm package")).rejects.toThrow();
    expect(await fixture.uploadCount()).toBe(0);
  });

  it("permits an absent Marketplace version", async () => {
    const fixture = await createFixture({
      response: { results: [{ extensions: [] }] },
    });
    await expect(
      fixture.run("Check existing Marketplace version"),
    ).resolves.toBe("");
    expect(await fixture.output()).toBe("exists=false\n");
  });

  it("skips an existing Marketplace version only after comparing its bytes", async () => {
    const fixture = await createFixture({
      response: marketplaceResponse(version),
    });
    await expect(
      fixture.run("Check existing Marketplace version"),
    ).resolves.toContain("already exists");
    expect(await fixture.output()).toBe("exists=true\n");
  });

  it.each([
    "Check existing Marketplace version",
    "Confirm Marketplace publication",
  ])("rejects conflicting Marketplace bytes during %s", async (name) => {
    const fixture = await createFixture({
      response: marketplaceResponse(version),
      downloadArchive: "conflicting archive",
    });
    await expect(fixture.run(name)).rejects.toThrow("does not match");
    expect(await fixture.output()).toBe("");
  });

  it.each([
    "Check existing Marketplace version",
    "Confirm Marketplace publication",
  ])("rejects unavailable Marketplace downloads during %s", async (name) => {
    const fixture = await createFixture({
      response: marketplaceResponse(version),
      downloadFailure: true,
    });
    await expect(fixture.run(name)).rejects.toThrow();
    expect(await fixture.output()).toBe("");
  });

  it.each([{}, { results: null }])(
    "does not upload on malformed Marketplace lookup %j",
    async (response) => {
      const fixture = await createFixture({ response });
      await expect(
        fixture.run("Check existing Marketplace version"),
      ).rejects.toThrow();
      expect(await fixture.output()).toBe("");
    },
  );
});
