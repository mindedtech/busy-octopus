/**
 * @file Verify the distributable package from clean consumer projects.
 */

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { z } from "zod";

const execFileAsync = promisify(execFile);

const MAXIMUM_PROCESS_OUTPUT_BYTE_COUNT = 1_048_576;
const repositoryDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDirectory = join(
  repositoryDirectory,
  "artifacts",
  "package-test",
);
const tarballPath = join(artifactDirectory, "busy-octopus.tgz");
const pnpmProcess =
  process.platform === "win32"
    ? {
        argumentList: ["/d", "/s", "/c", "pnpm"],
        command: process.env.ComSpec ?? "cmd.exe",
      }
    : { argumentList: [], command: "pnpm" };

const PackResult = z.strictObject({
  name: z.literal("busy-octopus"),
  version: z.string(),
  filename: z.string(),
  files: z.array(z.strictObject({ path: z.string() })),
});

const QueueRequest = z.strictObject({
  schemaVersion: z.literal(1),
  notificationId: z.string(),
  creationTime: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  workspace: z.strictObject({
    instanceId: z.string(),
    display: z.strictObject({
      label: z.string().nullable(),
      branch: z.string().nullable(),
    }),
  }),
  source: z.strictObject({ kind: z.string(), name: z.string() }).nullable(),
});

const allowFileList = [
  "LICENSE",
  "README.md",
  "dist/library/index.d.ts",
  "dist/library/index.js",
  "dist/library/notify.d.ts",
  "dist/library/notify.js",
  "dist/protocol/notification.d.ts",
  "dist/protocol/notification.js",
  "dist/protocol/text.d.ts",
  "dist/protocol/text.js",
  "dist/protocol/workspace.d.ts",
  "dist/protocol/workspace.js",
  "dist/queue/file-system.d.ts",
  "dist/queue/file-system.js",
  "dist/queue/location.d.ts",
  "dist/queue/location.js",
  "dist/queue/native.d.ts",
  "dist/queue/native.js",
  "dist/queue/queue.d.ts",
  "dist/queue/queue.js",
  "dist/workspace/identity.d.ts",
  "dist/workspace/identity.js",
  "dist/workspace/resolution.d.ts",
  "dist/workspace/resolution.js",
  "dist/workspace/runtime.d.ts",
  "dist/workspace/runtime.js",
  "package.json",
];

const execute = async ({
  argumentList,
  command,
  directory,
  environment = process.env,
}: {
  argumentList: string[];
  command: string;
  directory: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<string> => {
  try {
    const { stdout } = await execFileAsync(command, argumentList, {
      cwd: directory,
      encoding: "utf8",
      env: environment,
      maxBuffer: MAXIMUM_PROCESS_OUTPUT_BYTE_COUNT,
      windowsHide: true,
    });
    return stdout;
  } catch (error: unknown) {
    if (!(error instanceof Error)) {
      throw error;
    }
    const outputList = [
      "stdout" in error && typeof error.stdout === "string" ? error.stdout : "",
      "stderr" in error && typeof error.stderr === "string" ? error.stderr : "",
    ].filter((output) => output.length > 0);
    if (outputList.length === 0) {
      throw error;
    }
    throw new Error(`${error.message}\n${outputList.join("\n")}`, {
      cause: error,
    });
  }
};

const runPnpm = async ({
  argumentList,
  directory = repositoryDirectory,
}: {
  argumentList: string[];
  directory?: string;
}): Promise<string> =>
  execute({
    argumentList: [...pnpmProcess.argumentList, ...argumentList],
    command: pnpmProcess.command,
    directory,
  });

const parseQueueRequest = async (path: string) => {
  try {
    const result = QueueRequest.safeParse(
      JSON.parse(await readFile(path, "utf8")),
    );
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

const readQueueRoot = async (queueRoot: string) => {
  try {
    return await readdir(queueRoot, { withFileTypes: true });
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const findQueueRequest = async ({
  notificationId,
  queueRoot,
}: {
  notificationId: string;
  queueRoot: string;
}) => {
  const workspaceEntryList = await readQueueRoot(queueRoot);
  for (const workspaceEntry of workspaceEntryList) {
    if (!workspaceEntry.isDirectory()) {
      continue;
    }
    const directory = join(queueRoot, workspaceEntry.name);
    for (const requestEntry of await readdir(directory, {
      withFileTypes: true,
    })) {
      if (!requestEntry.isFile() || !requestEntry.name.endsWith(".json")) {
        continue;
      }
      const request = await parseQueueRequest(
        join(directory, requestEntry.name),
      );
      if (request?.notificationId === notificationId) {
        return { directory, request };
      }
    }
  }
  return null;
};

it("publishes through the packed package", async () => {
  const fixtureDirectory = await mkdtemp(
    join(tmpdir(), "busy-octopus-package-"),
  );
  const runtimeTemporaryDirectory = join(fixtureDirectory, "runtime");
  const queueRoot = join(runtimeTemporaryDirectory, "busy-octopus", "v1");
  const workspaceDirectory = join(fixtureDirectory, "synthetic-workspace");
  const notificationId = `package-notification-${randomUUID()}`;

  try {
    await rm(artifactDirectory, { force: true, recursive: true });
    await mkdir(artifactDirectory, { recursive: true });
    await mkdir(runtimeTemporaryDirectory);
    await mkdir(workspaceDirectory);
    await runPnpm({ argumentList: ["build"] });

    const packResult = PackResult.parse(
      JSON.parse(
        await runPnpm({
          argumentList: ["pack", "--out", tarballPath, "--json"],
        }),
      ),
    );
    expect(packResult.files.map(({ path }) => path).toSorted()).toEqual(
      allowFileList.toSorted(),
    );

    await writeFile(
      join(fixtureDirectory, "package.json"),
      JSON.stringify({
        name: "busy-octopus-package-fixture",
        private: true,
        type: "module",
        dependencies: {
          "busy-octopus": pathToFileURL(tarballPath).href,
        },
      }),
    );
    await runPnpm({
      argumentList: ["install", "--prefer-offline", "--ignore-workspace"],
      directory: fixtureDirectory,
    });

    const javascriptPath = join(fixtureDirectory, "consumer.mjs");
    await writeFile(
      javascriptPath,
      `import { deepStrictEqual, ok } from "node:assert/strict";

const library = await import("busy-octopus");
deepStrictEqual(Object.keys(library), ["notify"]);

let deepImportUnavailable = false;
try {
  await import("busy-octopus/dist/queue/queue.js");
} catch (error) {
  deepImportUnavailable =
    error instanceof Error &&
    "code" in error &&
    error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED";
}
ok(deepImportUnavailable, "Queue internals must not be importable.");

process.stdout.write(JSON.stringify(await library.notify({
  body: null,
  directory: process.argv[2],
  notificationId: process.argv[3],
  source: null,
  title: "Synthetic package notification",
})));
`,
    );
    const NotifyResult = z.strictObject({ notificationId: z.string() });
    expect(
      NotifyResult.parse(
        JSON.parse(
          await execute({
            argumentList: [javascriptPath, workspaceDirectory, notificationId],
            command: process.execPath,
            directory: fixtureDirectory,
            environment: {
              ...process.env,
              TEMP: runtimeTemporaryDirectory,
              TMP: runtimeTemporaryDirectory,
              TMPDIR: runtimeTemporaryDirectory,
            },
          }),
        ),
      ).notificationId,
    ).toBe(notificationId);

    const typescriptPath = join(fixtureDirectory, "consumer.ts");
    await writeFile(
      typescriptPath,
      `import {
  notify,
  type NotificationSource,
  type NotifyInput,
  type NotifyResult,
} from "busy-octopus";

const source: NotificationSource = { kind: "test", name: "Synthetic runner" };
const input: NotifyInput = {
  body: null,
  directory: ${JSON.stringify(workspaceDirectory)},
  source,
  title: "Synthetic package notification",
};
const result: Promise<NotifyResult> = notify(input);
void result;
`,
    );
    await execute({
      argumentList: [
        join(repositoryDirectory, "node_modules", "typescript", "bin", "tsc"),
        "--noEmit",
        "--strict",
        "--exactOptionalPropertyTypes",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--target",
        "ES2023",
        typescriptPath,
      ],
      command: process.execPath,
      directory: fixtureDirectory,
    });

    const queueResult = await findQueueRequest({ notificationId, queueRoot });
    expect(queueResult).not.toBeNull();
    if (queueResult === null) {
      return;
    }
    expect(queueResult.request.workspace.display.label).toBe(
      basename(workspaceDirectory),
    );
    expect(queueResult.request.workspace.display.branch).toBeNull();
    expect(basename(queueResult.directory)).toBe(
      queueResult.request.workspace.instanceId,
    );
  } finally {
    const queueResult = await findQueueRequest({ notificationId, queueRoot });
    if (queueResult !== null) {
      await rm(queueResult.directory, { force: true, recursive: true });
    }
    await Promise.all([
      rm(fixtureDirectory, { force: true, recursive: true }),
      rm(artifactDirectory, { force: true, recursive: true }),
    ]);
  }
}, 60_000);
