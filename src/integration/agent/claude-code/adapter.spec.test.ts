/**
 * @file Verify Claude Code hook conversion.
 */

import { describe, expect, it } from "vitest";
import type { NotifyInput } from "../../../library/notify.js";
import { type ClaudeCodeHook, claudeCodeHookAdapter } from "./adapter.js";

const stopHook = {
  session_id: "session-1",
  prompt_id: "123e4567-e89b-42d3-a456-426614174000",
  transcript_path: "/synthetic/transcript.jsonl",
  cwd: "/synthetic/workspace",
  permission_mode: "default",
  hook_event_name: "Stop",
  stop_hook_active: false,
  last_assistant_message: " Work is complete. ",
  background_tasks: [],
  session_crons: [],
} satisfies ClaudeCodeHook;

describe("claudeCodeHookAdapter", () => {
  it("converts a completed turn", () => {
    expect(claudeCodeHookAdapter.createNotification(stopHook)).toEqual({
      body: "Work is complete.",
      directory: "/synthetic/workspace",
      notificationId: "claude-turn-f1951b22d58de24e00e512f186cffb22",
      source: { kind: "agent", name: "Claude Code" },
      title: "Claude Code",
    } satisfies NotifyInput);
  });

  it("converts a completed turn without details", () => {
    const { last_assistant_message: _, ...hook } = stopHook;

    expect(claudeCodeHookAdapter.createNotification(hook)).toMatchObject({
      body: null,
      source: { kind: "agent", name: "Claude Code" },
      title: "Claude Code",
    } satisfies Partial<NotifyInput>);
  });

  it("converts a failed turn without exposing error details", () => {
    expect(
      claudeCodeHookAdapter.createNotification({
        session_id: "session-1",
        prompt_id: "123e4567-e89b-42d3-a456-426614174000",
        transcript_path: "/synthetic/transcript.jsonl",
        cwd: "/synthetic/workspace",
        hook_event_name: "StopFailure",
        error: "rate_limit",
        error_details: "Synthetic provider detail.",
        last_assistant_message: "Synthetic error message.",
      }),
    ).toEqual({
      body: null,
      directory: "/synthetic/workspace",
      notificationId: "claude-failure-f1951b22d58de24e00e512f186cffb22",
      source: { kind: "agent", name: "Claude Code" },
      title: "Turn stopped with an error.",
    } satisfies NotifyInput);
  });

  it("converts an input request", () => {
    expect(
      claudeCodeHookAdapter.createNotification({
        session_id: "session-1",
        prompt_id: "123e4567-e89b-42d3-a456-426614174000",
        transcript_path: "/synthetic/transcript.jsonl",
        cwd: "/synthetic/workspace",
        permission_mode: "default",
        hook_event_name: "PreToolUse",
        tool_name: "AskUserQuestion",
        tool_input: { questions: [] },
        tool_use_id: "tool-1",
      } satisfies ClaudeCodeHook),
    ).toEqual({
      body: null,
      directory: "/synthetic/workspace",
      notificationId: "claude-input-cef82ab2f2d654e69494ec86e26e6b60",
      source: { kind: "agent", name: "Claude Code" },
      title: "Input required.",
    } satisfies NotifyInput);
  });

  it.each([
    ["permission_prompt", "Approval required."],
    ["elicitation_dialog", "Input required."],
    ["elicitation_url_dialog", "Input required."],
    ["agent_needs_input", "Input required."],
  ] as const)("converts %s notifications", (notificationType, title) => {
    expect(
      claudeCodeHookAdapter.createNotification({
        session_id: "session-1",
        prompt_id: "123e4567-e89b-42d3-a456-426614174000",
        transcript_path: "/synthetic/transcript.jsonl",
        cwd: "/synthetic/workspace",
        hook_event_name: "Notification",
        message: "Synthetic notification.",
        title: "Synthetic title",
        notification_type: notificationType,
      } satisfies ClaudeCodeHook),
    ).toMatchObject({
      body: null,
      directory: "/synthetic/workspace",
      source: { kind: "agent", name: "Claude Code" },
      title,
    } satisfies Partial<NotifyInput>);
  });

  it("rejects provider additions that have not been reviewed", () => {
    expect(() =>
      claudeCodeHookAdapter.createNotification({
        ...stopHook,
        synthetic: true,
      }),
    ).toThrow();
  });

  it("rejects unsupported notification types", () => {
    expect(() =>
      claudeCodeHookAdapter.createNotification({
        session_id: "session-1",
        transcript_path: "/synthetic/transcript.jsonl",
        cwd: "/synthetic/workspace",
        hook_event_name: "Notification",
        message: "Synthetic notification.",
        notification_type: "idle_prompt",
      }),
    ).toThrow();
  });

  it("returns no Claude Code output", () => {
    expect(claudeCodeHookAdapter.reply).toBe("");
  });
});
