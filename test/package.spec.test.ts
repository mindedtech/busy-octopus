/**
 * @file Verify the distributable package from clean consumer projects.
 */

import { execFile, spawnSync } from "node:child_process";
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
import { assert, expect, it } from "vitest";
import { z } from "zod";
import type { ClaudeCodeHook } from "../src/integration/agent/claude-code/adapter.js";
import type { CodexHook } from "../src/integration/agent/codex/adapter.js";

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
  "dist/cli/main.js",
  "dist/extension/extension.cjs",
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
  "dist/workspace/queue.d.ts",
  "dist/workspace/queue.js",
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
  environment,
}: {
  argumentList: string[];
  directory?: string;
  environment?: NodeJS.ProcessEnv;
}): Promise<string> =>
  execute({
    argumentList: [...pnpmProcess.argumentList, ...argumentList],
    command: pnpmProcess.command,
    directory,
    ...(environment === undefined ? {} : { environment }),
  });

const runPnpmInput = ({
  argumentList,
  directory,
  environment,
  input,
}: {
  argumentList: string[];
  directory: string;
  environment: NodeJS.ProcessEnv;
  input: string;
}): { stderr: string; stdout: string } => {
  const result = spawnSync(
    pnpmProcess.command,
    [...pnpmProcess.argumentList, ...argumentList],
    {
      cwd: directory,
      encoding: "utf8",
      env: environment,
      input,
      maxBuffer: MAXIMUM_PROCESS_OUTPUT_BYTE_COUNT,
      windowsHide: true,
    },
  );

  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);

  return { stderr: result.stderr, stdout: result.stdout };
};

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

const readQueuePathList = async (queueRoot: string): Promise<string[]> => {
  const pathList: string[] = [];

  for (const workspaceEntry of await readQueueRoot(queueRoot)) {
    if (!workspaceEntry.isDirectory()) {
      continue;
    }

    const directory = join(queueRoot, workspaceEntry.name);

    for (const requestEntry of await readdir(directory, {
      withFileTypes: true,
    })) {
      if (requestEntry.isFile() && requestEntry.name.endsWith(".json")) {
        pathList.push(join(directory, requestEntry.name));
      }
    }
  }

  return pathList;
};

const findQueueRequest = async ({
  notificationId,
  queueRoot,
}: {
  notificationId: string;
  queueRoot: string;
}) => {
  for (const path of await readQueuePathList(queueRoot)) {
    const request = await parseQueueRequest(path);

    if (request?.notificationId === notificationId) {
      return { directory: dirname(path), request };
    }
  }
  return null;
};

it("verifies the packed library and CLI", { timeout: 30_000 }, async () => {
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

    expect(
      PackResult.parse(
        JSON.parse(
          await runPnpm({
            argumentList: ["pack", "--out", tarballPath, "--json"],
          }),
        ),
      )
        .files.map(({ path }) => path)
        .toSorted(),
    ).toEqual(allowFileList.toSorted());

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

    const runtimeEnvironment = {
      ...process.env,
      TEMP: runtimeTemporaryDirectory,
      TMP: runtimeTemporaryDirectory,
      TMPDIR: runtimeTemporaryDirectory,
    };
    await expect(
      runPnpm({
        argumentList: [
          "exec",
          "busy-octopus",
          "doctor",
          "--directory",
          workspaceDirectory,
        ],
        directory: fixtureDirectory,
        environment: runtimeEnvironment,
      }),
    ).resolves.toBe("Workspace resolution: ok\nQueue routing: ok\n");
    expect(await readQueueRoot(queueRoot)).toEqual([]);

    const cliPath = join(
      fixtureDirectory,
      "node_modules",
      "busy-octopus",
      "dist",
      "cli",
      "main.js",
    );
    const commandResult = spawnSync(
      process.execPath,
      [
        cliPath,
        "run",
        "--tail",
        "--",
        process.execPath,
        "-e",
        'process.stdout.write("synthetic stdout\\n"); process.stderr.write("synthetic stderr\\n"); process.exit(7)',
      ],
      {
        cwd: fixtureDirectory,
        encoding: "utf8",
        maxBuffer: MAXIMUM_PROCESS_OUTPUT_BYTE_COUNT,
        timeout: 5_000,
        env: runtimeEnvironment,
        windowsHide: true,
      },
    );

    expect(commandResult.error).toBeUndefined();
    expect(commandResult.status).toBe(7);
    expect(commandResult.signal).toBeNull();
    expect(commandResult.stdout).toBe("synthetic stdout\n");
    expect(commandResult.stderr).toBe("synthetic stderr\n");

    const commandQueuePathList = await readQueuePathList(queueRoot);
    expect(commandQueuePathList).toHaveLength(1);
    const [commandQueuePath] = commandQueuePathList;
    assert(
      commandQueuePath !== undefined,
      "Command request path must be available.",
    );
    const commandRequest = await parseQueueRequest(commandQueuePath);
    assert(
      commandRequest !== null,
      "Command result must reach a workspace queue.",
    );
    expect(commandRequest).toMatchObject({
      source: { kind: "command", name: basename(process.execPath) },
      title: "Failed with exit code 7.",
    } satisfies Partial<z.infer<typeof QueueRequest>>);
    expect(commandRequest.body?.split("\n").toSorted()).toEqual([
      "synthetic stderr",
      "synthetic stdout",
    ]);
    if (process.platform !== "win32") {
      const signalResult = spawnSync(
        process.execPath,
        [
          cliPath,
          "run",
          "--success-only",
          "--",
          process.execPath,
          "-e",
          'process.kill(process.pid, "SIGTERM")',
        ],
        {
          cwd: fixtureDirectory,
          encoding: "utf8",
          maxBuffer: MAXIMUM_PROCESS_OUTPUT_BYTE_COUNT,
          timeout: 5_000,
          env: runtimeEnvironment,
          windowsHide: true,
        },
      );

      expect(signalResult.error).toBeUndefined();
      expect(signalResult.status).toBeNull();
      expect(signalResult.signal).toBe("SIGTERM");
      expect(signalResult.stdout).toBe("");
      expect(signalResult.stderr).toBe("");
    }

    const cliNotificationId = `cli-notification-${randomUUID()}`;
    await expect(
      runPnpm({
        argumentList: [
          "exec",
          "busy-octopus",
          "notify",
          "--title",
          "Synthetic CLI notification",
          "--body",
          "Review the synthetic CLI result.",
          "--directory",
          workspaceDirectory,
          "--notification-id",
          cliNotificationId,
          "--source-kind",
          "test",
          "--source-name",
          "Synthetic CLI runner",
        ],
        directory: fixtureDirectory,
        environment: runtimeEnvironment,
      }),
    ).resolves.toBe(`${cliNotificationId}\n`);
    const cliQueueResult = await findQueueRequest({
      notificationId: cliNotificationId,
      queueRoot,
    });
    assert(
      cliQueueResult !== null,
      "CLI request must reach a workspace queue.",
    );
    expect(cliQueueResult.request).toMatchObject({
      notificationId: cliNotificationId,
      title: "Synthetic CLI notification",
      body: "Review the synthetic CLI result.",
      source: { kind: "test", name: "Synthetic CLI runner" },
    });

    await expect(
      runPnpm({
        argumentList: [
          "exec",
          "busy-octopus",
          "agent",
          "setup",
          "codex",
          "--directory",
          workspaceDirectory,
          "--yes",
        ],
        directory: fixtureDirectory,
        environment: runtimeEnvironment,
      }),
    ).resolves.toBe("configured\n");
    expect(
      JSON.parse(
        await readFile(
          join(workspaceDirectory, ".codex", "hooks.json"),
          "utf8",
        ),
      ),
    ).toMatchObject({
      hooks: {
        Stop: [
          {
            hooks: [
              {
                command: "busy-octopus agent hook codex",
                timeout: 2,
                type: "command",
              },
            ],
          },
        ],
      },
    });

    expect(
      runPnpmInput({
        argumentList: ["exec", "busy-octopus", "agent", "hook", "codex"],
        directory: fixtureDirectory,
        environment: runtimeEnvironment,
        input: JSON.stringify({
          session_id: "package-session",
          transcript_path: null,
          cwd: workspaceDirectory,
          hook_event_name: "Stop",
          model: "gpt-synthetic",
          permission_mode: "default",
          turn_id: "package-turn",
          stop_hook_active: false,
          last_assistant_message: "Synthetic Codex result.",
        } satisfies CodexHook),
      }),
    ).toEqual({ stderr: "", stdout: "{}\n" });
    expect(
      await findQueueRequest({
        notificationId: "codex-turn-255c7515a88c50aa9915122472e60b11",
        queueRoot,
      }),
    ).toMatchObject({
      request: {
        body: "Synthetic Codex result.",
        source: { kind: "agent", name: "Codex" },
        title: "Codex",
      },
    });

    expect(
      runPnpmInput({
        argumentList: ["exec", "busy-octopus", "agent", "hook", "claude-code"],
        directory: fixtureDirectory,
        environment: runtimeEnvironment,
        input: JSON.stringify({
          session_id: "package-session",
          prompt_id: "123e4567-e89b-42d3-a456-426614174000",
          transcript_path: "/synthetic/transcript.jsonl",
          cwd: workspaceDirectory,
          hook_event_name: "Stop",
          stop_hook_active: false,
          last_assistant_message: "Synthetic Claude Code result.",
        } satisfies ClaudeCodeHook),
      }),
    ).toEqual({ stderr: "", stdout: "" });
    expect(
      await findQueueRequest({
        notificationId: "claude-turn-64a66c74259f1ae0046dab1ec55d0130",
        queueRoot,
      }),
    ).toMatchObject({
      request: {
        body: "Synthetic Claude Code result.",
        source: { kind: "agent", name: "Claude Code" },
        title: "Claude Code",
      },
    });

    expect(
      runPnpmInput({
        argumentList: ["exec", "busy-octopus", "agent", "hook", "codex"],
        directory: fixtureDirectory,
        environment: runtimeEnvironment,
        input: "{",
      }),
    ).toEqual({
      stderr: "busy-octopus: unable to process the agent hook.\n",
      stdout: "{}\n",
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
            environment: runtimeEnvironment,
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
    assert(
      queueResult !== null,
      "Library request must reach a workspace queue.",
    );
    expect(queueResult.request.workspace.display.label).toBe(
      basename(workspaceDirectory),
    );
    expect(queueResult.request.workspace.display.branch).toBeNull();
    expect(basename(queueResult.directory)).toBe(
      queueResult.request.workspace.instanceId,
    );
    expect(queueResult.directory).toBe(cliQueueResult.directory);

    const primaryCheckoutDirectory = join(fixtureDirectory, "primary-checkout");
    const worktreeDirectory = join(fixtureDirectory, "linked-worktree");
    await execute({
      argumentList: [
        "clone",
        "--local",
        "--no-hardlinks",
        "--quiet",
        repositoryDirectory,
        primaryCheckoutDirectory,
      ],
      command: "git",
      directory: fixtureDirectory,
    });
    await execute({
      argumentList: [
        "-C",
        primaryCheckoutDirectory,
        "worktree",
        "add",
        "--quiet",
        "--detach",
        worktreeDirectory,
      ],
      command: "git",
      directory: fixtureDirectory,
    });

    const primaryNotificationId = `primary-notification-${randomUUID()}`;
    const worktreeNotificationId = `linked-notification-${randomUUID()}`;
    for (const [directory, checkoutNotificationId] of [
      [join(primaryCheckoutDirectory, "src"), primaryNotificationId],
      [join(worktreeDirectory, "src"), worktreeNotificationId],
    ] as const) {
      await expect(
        runPnpm({
          argumentList: [
            "exec",
            "busy-octopus",
            "notify",
            "--title",
            "Synthetic checkout notification",
            "--directory",
            directory,
            "--notification-id",
            checkoutNotificationId,
          ],
          directory: fixtureDirectory,
          environment: runtimeEnvironment,
        }),
      ).resolves.toBe(`${checkoutNotificationId}\n`);
    }

    const primaryQueueResult = await findQueueRequest({
      notificationId: primaryNotificationId,
      queueRoot,
    });
    const worktreeQueueResult = await findQueueRequest({
      notificationId: worktreeNotificationId,
      queueRoot,
    });
    assert(
      primaryQueueResult !== null,
      "Primary checkout request must reach a workspace queue.",
    );
    assert(
      worktreeQueueResult !== null,
      "Linked worktree request must reach a workspace queue.",
    );
    expect(worktreeQueueResult.directory).not.toBe(
      primaryQueueResult.directory,
    );
    expect(primaryQueueResult.request.workspace.display.label).toBe(
      basename(primaryCheckoutDirectory),
    );
    expect(worktreeQueueResult.request.workspace.display.label).toBe(
      basename(worktreeDirectory),
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
});
