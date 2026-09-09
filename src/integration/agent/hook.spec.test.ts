/**
 * @file Verify fail-open agent hook execution.
 */

import { describe, expect, it, vi } from "vitest";
import type { CodexHook } from "./codex/adapter.js";
import { runAgentHook } from "./hook.js";

const hook = {
  session_id: "session-1",
  transcript_path: null,
  cwd: "/synthetic/workspace",
  hook_event_name: "Stop",
  model: "gpt-synthetic",
  permission_mode: "default",
  turn_id: "turn-1",
  stop_hook_active: false,
  last_assistant_message: null,
} satisfies CodexHook;

describe("runAgentHook", () => {
  it("publishes provider notification input", async () => {
    const notify = vi.fn().mockResolvedValue({ notificationId: "request-1" });
    const warn = vi.fn();

    await expect(
      runAgentHook({
        notify,
        provider: "codex",
        readInput: () => Promise.resolve(JSON.stringify(hook)),
        warn,
      }),
    ).resolves.toBe("{}\n");
    expect(notify).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: "/synthetic/workspace",
        title: "Codex",
      }),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ["input read", () => Promise.reject(new Error("Synthetic read failure."))],
    ["JSON parsing", () => Promise.resolve("{")],
  ])("fails open after %s failure", async (_domain, readInput) => {
    const notify = vi.fn();
    const warn = vi.fn();

    await expect(
      runAgentHook({
        notify,
        provider: "codex",
        readInput,
        warn,
      }),
    ).resolves.toBe("{}\n");
    expect(notify).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("fails open after provider validation failure", async () => {
    const notify = vi.fn();
    const warn = vi.fn();

    await expect(
      runAgentHook({
        notify,
        provider: "claude-code",
        readInput: () => Promise.resolve(JSON.stringify(hook)),
        warn,
      }),
    ).resolves.toBe("");
    expect(notify).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("fails open after publication failure", async () => {
    const notify = vi
      .fn()
      .mockRejectedValue(new Error("Synthetic publication failure."));
    const warn = vi.fn();

    await expect(
      runAgentHook({
        notify,
        provider: "codex",
        readInput: () => Promise.resolve(JSON.stringify(hook)),
        warn,
      }),
    ).resolves.toBe("{}\n");
    expect(warn).toHaveBeenCalledOnce();
  });
});
