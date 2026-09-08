/**
 * @file Verify workspace agent hook setup.
 */

import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveWorkspace } from "../../workspace/resolution.js";
import { ClaudeCodeConfig } from "./claude-code/config.js";
import { CodexConfig } from "./codex/config.js";
import { setupAgent } from "./setup.js";

let fixtureDirectory: string;

beforeEach(async () => {
  fixtureDirectory = await mkdtemp(join(tmpdir(), "busy-octopus-agent-"));
});

afterEach(async () => {
  await rm(fixtureDirectory, { force: true, recursive: true });
});

describe("setupAgent", () => {
  it("creates a Codex configuration after confirmation", async () => {
    const confirm = vi.fn().mockResolvedValue(true);

    await expect(
      setupAgent({
        enableAttention: false,
        confirm,
        directory: fixtureDirectory,
        provider: "codex",
      }),
    ).resolves.toBe("configured");

    const path = join(
      (await resolveWorkspace({ directory: fixtureDirectory })).path,
      ".codex",
      "hooks.json",
    );
    expect(confirm).toHaveBeenCalledWith({ path, provider: "codex" });
    expect(
      CodexConfig.parse(JSON.parse(await readFile(path, "utf8"))),
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
    } satisfies Partial<CodexConfig>);
  });

  it("does not create configuration after cancellation", async () => {
    await expect(
      setupAgent({
        enableAttention: false,
        confirm: () => Promise.resolve(false),
        directory: fixtureDirectory,
        provider: "claude-code",
      }),
    ).resolves.toBe("cancelled");

    await expect(stat(join(fixtureDirectory, ".claude"))).rejects.toMatchObject(
      { code: "ENOENT" },
    );
  });

  it("leaves a current configuration byte-for-byte unchanged", async () => {
    await setupAgent({
      enableAttention: true,
      confirm: () => Promise.resolve(true),
      directory: fixtureDirectory,
      provider: "claude-code",
    });
    const path = join(fixtureDirectory, ".claude", "settings.json");
    const configText = await readFile(path, "utf8");
    const confirm = vi.fn();

    await expect(
      setupAgent({
        enableAttention: true,
        confirm,
        directory: fixtureDirectory,
        provider: "claude-code",
      }),
    ).resolves.toBe("unchanged");
    expect(confirm).not.toHaveBeenCalled();
    await expect(readFile(path, "utf8")).resolves.toBe(configText);
  });

  it("updates a configuration without removing unrelated values", async () => {
    const directory = join(fixtureDirectory, ".claude");
    const path = join(directory, "settings.json");
    await mkdir(directory);
    await writeFile(
      path,
      JSON.stringify({
        enabledPlugins: { "synthetic@example": true },
        hooks: {
          Stop: [
            {
              hooks: [{ command: "synthetic-command", type: "command" }],
            },
          ],
        },
      } satisfies ClaudeCodeConfig),
    );

    await expect(
      setupAgent({
        enableAttention: false,
        confirm: () => Promise.resolve(true),
        directory: fixtureDirectory,
        provider: "claude-code",
      }),
    ).resolves.toBe("updated");
    expect(
      ClaudeCodeConfig.parse(JSON.parse(await readFile(path, "utf8"))),
    ).toMatchObject({
      enabledPlugins: { "synthetic@example": true },
      hooks: {
        Stop: [
          {
            hooks: [
              { command: "synthetic-command", type: "command" },
              {
                command: "busy-octopus agent hook claude-code",
                timeout: 2,
                type: "command",
              },
            ],
          },
        ],
      },
    } satisfies Partial<ClaudeCodeConfig>);
  });

  it("preserves CRLF line endings when updating a configuration", async () => {
    const directory = join(fixtureDirectory, ".claude");
    const path = join(directory, "settings.json");
    await mkdir(directory);
    await writeFile(
      path,
      `${JSON.stringify(
        {
          hooks: {
            Stop: [{ hooks: [{ command: "synthetic", type: "command" }] }],
          },
        } satisfies ClaudeCodeConfig,
        null,
        2,
      ).replaceAll("\n", "\r\n")}\r\n`,
    );

    await expect(
      setupAgent({
        enableAttention: false,
        confirm: () => Promise.resolve(true),
        directory: fixtureDirectory,
        provider: "claude-code",
      }),
    ).resolves.toBe("updated");
    const configText = await readFile(path, "utf8");

    expect(configText).toContain("\r\n");
    expect(configText.replaceAll("\r\n", "")).not.toContain("\n");
  });

  it("rejects configuration beyond the byte limit", async () => {
    const directory = join(fixtureDirectory, ".codex");
    const path = join(directory, "hooks.json");
    const confirm = vi.fn();
    await mkdir(directory);
    await writeFile(path, JSON.stringify({ value: "x".repeat(1_048_577) }));

    await expect(
      setupAgent({
        enableAttention: false,
        confirm,
        directory: fixtureDirectory,
        provider: "codex",
      }),
    ).rejects.toThrow("Agent configuration exceeds the byte limit.");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("does not replace malformed JSON", async () => {
    const directory = join(fixtureDirectory, ".codex");
    const path = join(directory, "hooks.json");
    await mkdir(directory);
    await writeFile(path, "{");

    await expect(
      setupAgent({
        enableAttention: false,
        confirm: () => Promise.resolve(true),
        directory: fixtureDirectory,
        provider: "codex",
      }),
    ).rejects.toThrow();
    await expect(readFile(path, "utf8")).resolves.toBe("{");
  });
});
