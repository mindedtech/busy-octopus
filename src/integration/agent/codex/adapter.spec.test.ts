/**
 * @file Verify Codex hook conversion.
 */

import { describe, expect, it } from "vitest";
import type { NotifyInput } from "../../../library/notify.js";
import { type CodexHook, codexHookAdapter } from "./adapter.js";

const stopHook = {
  session_id: "session-1",
  transcript_path: "/synthetic/transcript.jsonl",
  cwd: "/synthetic/workspace",
  hook_event_name: "Stop",
  model: "gpt-synthetic",
  permission_mode: "default",
  turn_id: "turn-1",
  stop_hook_active: false,
  last_assistant_message: " Work is complete. ",
} satisfies CodexHook;

describe("codexHookAdapter", () => {
  it("converts a completed turn", () => {
    expect(codexHookAdapter.createNotification(stopHook)).toEqual({
      body: "Work is complete.",
      directory: "/synthetic/workspace",
      notificationId: "codex-turn-1a127ab4a5bfd9d460a4f30311ed68ee",
      source: { kind: "agent", name: "Codex" },
      title: "Codex",
    } satisfies NotifyInput);
  });

  it.each(["request_user_input", "request_user_input_async"] satisfies Extract<
    CodexHook,
    { hook_event_name: "PreToolUse" }
  >["tool_name"][])("converts %s to an input notification", (toolName) => {
    expect(
      codexHookAdapter.createNotification({
        session_id: "session-1",
        transcript_path: null,
        cwd: "/synthetic/workspace",
        hook_event_name: "PreToolUse",
        model: "gpt-synthetic",
        permission_mode: "default",
        turn_id: "turn-1",
        tool_name: toolName,
        tool_use_id: "tool-1",
        tool_input: { questions: [] },
      } satisfies CodexHook),
    ).toEqual({
      body: null,
      directory: "/synthetic/workspace",
      notificationId: "codex-input-cef82ab2f2d654e69494ec86e26e6b60",
      source: { kind: "agent", name: "Codex" },
      title: "Input required.",
    } satisfies NotifyInput);
  });

  it("clips notification details by Unicode code point", () => {
    expect(
      codexHookAdapter.createNotification({
        ...stopHook,
        last_assistant_message: "🐙".repeat(1_025),
      })?.body,
    ).toBe("🐙".repeat(1_024));
  });

  it("rejects an unknown field", () => {
    expect(() =>
      codexHookAdapter.createNotification({
        ...stopHook,
        synthetic: true,
      }),
    ).toThrow();
  });

  it("rejects an unsupported event", () => {
    expect(() =>
      codexHookAdapter.createNotification({
        ...stopHook,
        hook_event_name: "SessionStart",
      }),
    ).toThrow();
  });

  it("returns neutral Codex output", () => {
    expect(codexHookAdapter.reply).toBe("{}\n");
  });
});
