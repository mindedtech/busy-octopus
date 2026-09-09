/**
 * @file Verify Claude Code hook configuration updates.
 */

import { describe, expect, it } from "vitest";
import { type ClaudeCodeConfig, configureClaudeCodeHooks } from "./config.js";

describe("configureClaudeCodeHooks", () => {
  it("adds turn hooks by default", () => {
    expect(
      configureClaudeCodeHooks({
        enableAttention: false,
        input: {},
      }),
    ).toEqual({
      hooks: {
        Stop: [
          {
            hooks: [
              {
                command: "busy-octopus agent hook claude-code",
                timeout: 2,
                type: "command",
              },
            ],
          },
        ],
        StopFailure: [
          {
            hooks: [
              {
                command: "busy-octopus agent hook claude-code",
                timeout: 2,
                type: "command",
              },
            ],
          },
        ],
      },
    } satisfies ClaudeCodeConfig);
  });

  it("adds attention hooks when enabled", () => {
    expect(
      configureClaudeCodeHooks({
        enableAttention: true,
        input: {},
      }),
    ).toMatchObject({
      hooks: {
        Notification: [
          {
            hooks: [
              {
                command: "busy-octopus agent hook claude-code",
                timeout: 2,
                type: "command",
              },
            ],
            matcher: "permission_prompt",
          },
          {
            hooks: [
              {
                command: "busy-octopus agent hook claude-code",
                timeout: 2,
                type: "command",
              },
            ],
            matcher:
              "elicitation_dialog|elicitation_url_dialog|agent_needs_input",
          },
        ],
        PreToolUse: [
          {
            hooks: [
              {
                command: "busy-octopus agent hook claude-code",
                timeout: 2,
                type: "command",
              },
            ],
            matcher: "AskUserQuestion",
          },
        ],
      },
    } satisfies Partial<ClaudeCodeConfig>);
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
                command: "busy-octopus agent hook claude-code",
                timeout: 8,
                type: "command",
              },
            ],
            synthetic: true,
          },
        ],
      },
    } satisfies ClaudeCodeConfig;

    expect(
      configureClaudeCodeHooks({
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
                command: "busy-octopus agent hook claude-code",
                timeout: 2,
                type: "command",
              },
            ],
            synthetic: true,
          },
        ],
      },
    } satisfies Partial<ClaudeCodeConfig>);
  });

  it("removes attention hooks when disabled", () => {
    const config = configureClaudeCodeHooks({
      enableAttention: true,
      input: {},
    });
    const result = configureClaudeCodeHooks({
      enableAttention: false,
      input: config,
    });

    expect(result).not.toHaveProperty("hooks.Notification");
    expect(result).not.toHaveProperty("hooks.PreToolUse");
  });

  it("returns the same configuration when repeated", () => {
    const config = configureClaudeCodeHooks({
      enableAttention: true,
      input: {},
    });

    expect(
      configureClaudeCodeHooks({
        enableAttention: true,
        input: config,
      }),
    ).toEqual(config);
  });

  it("rejects an invalid Claude Code hook structure", () => {
    expect(() =>
      configureClaudeCodeHooks({
        enableAttention: false,
        input: { hooks: { Stop: {} } },
      }),
    ).toThrow();
  });
});
