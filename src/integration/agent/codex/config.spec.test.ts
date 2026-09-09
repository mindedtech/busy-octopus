/**
 * @file Verify Codex hook configuration updates.
 */

import { describe, expect, it } from "vitest";
import { type CodexConfig, configureCodexHooks } from "./config.js";

describe("configureCodexHooks", () => {
  it("adds the turn hook by default", () => {
    expect(
      configureCodexHooks({
        enableAttention: false,
        input: {},
      }),
    ).toEqual({
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
    } satisfies CodexConfig);
  });

  it("adds the attention hook when enabled", () => {
    expect(
      configureCodexHooks({
        enableAttention: true,
        input: {},
      }),
    ).toMatchObject({
      hooks: {
        PreToolUse: [
          {
            hooks: [
              {
                command: "busy-octopus agent hook codex",
                timeout: 2,
                type: "command",
              },
            ],
            matcher: "^request_user_input(_async)?$",
          },
        ],
      },
    } satisfies Partial<CodexConfig>);
  });

  it("preserves unrelated settings, groups, and handlers", () => {
    const input = {
      synthetic: true,
      hooks: {
        SessionStart: [
          {
            hooks: [{ command: "synthetic-command", type: "command" }],
            matcher: "startup",
          },
        ],
        Stop: [
          {
            hooks: [
              { command: "synthetic-command", type: "command" },
              {
                command: "busy-octopus agent hook codex",
                timeout: 8,
                type: "command",
              },
            ],
            synthetic: true,
          },
        ],
      },
    } satisfies CodexConfig;

    expect(
      configureCodexHooks({
        enableAttention: false,
        input,
      }),
    ).toMatchObject({
      synthetic: true,
      hooks: {
        SessionStart: input.hooks.SessionStart,
        Stop: [
          {
            hooks: [
              { command: "synthetic-command", type: "command" },
              {
                command: "busy-octopus agent hook codex",
                timeout: 2,
                type: "command",
              },
            ],
            synthetic: true,
          },
        ],
      },
    } satisfies Partial<CodexConfig>);
  });

  it("removes the attention hook when disabled", () => {
    const config = configureCodexHooks({
      enableAttention: true,
      input: {},
    });

    expect(
      configureCodexHooks({
        enableAttention: false,
        input: config,
      }),
    ).not.toHaveProperty("hooks.PreToolUse");
  });

  it("returns the same configuration when repeated", () => {
    const config = configureCodexHooks({
      enableAttention: true,
      input: {},
    });

    expect(
      configureCodexHooks({
        enableAttention: true,
        input: config,
      }),
    ).toEqual(config);
  });

  it("rejects an invalid Codex hook structure", () => {
    expect(() =>
      configureCodexHooks({
        enableAttention: false,
        input: { hooks: { Stop: {} } },
      }),
    ).toThrow();
  });
});
