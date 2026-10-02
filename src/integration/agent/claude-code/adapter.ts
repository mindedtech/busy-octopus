/**
 * @file Convert Claude Code lifecycle hooks into generic notifications.
 *
 * @see https://code.claude.com/docs/en/hooks
 */

import { createHash } from "node:crypto";
import { z } from "zod";
import type { NotifyInput } from "../../../library/notify.js";
import type { AgentAdapter } from "../adapter.js";
import { agentNotificationBody } from "../text.js";
import { configureClaudeCodeHooks } from "./config.js";

const commonShape = {
  session_id: z.string().min(1).max(512),
  prompt_id: z.uuid().optional(),
  transcript_path: z.string().max(4_096),
  cwd: z.string().min(1).max(4_096),
  agent_id: z.string().min(1).max(512).optional(),
  agent_type: z.string().min(1).max(256).optional(),
} satisfies z.ZodRawShape;

const ClaudeStopHook = z.object({
  ...commonShape,
  hook_event_name: z.literal("Stop"),
  stop_hook_active: z.boolean(),
  last_assistant_message: z.string().max(65_536).optional(),
  background_tasks: z.array(z.unknown()).max(1_024).optional(),
  session_crons: z.array(z.unknown()).max(1_024).optional(),
});

const ClaudeFailureHook = z.object({
  ...commonShape,
  hook_event_name: z.literal("StopFailure"),
  error_details: z.string().max(65_536).optional(),
  last_assistant_message: z.string().max(65_536).optional(),
});

const ClaudeInputHook = z.object({
  ...commonShape,
  hook_event_name: z.literal("PreToolUse"),
  tool_name: z.literal("AskUserQuestion"),
  tool_input: z.unknown(),
  tool_use_id: z.string().min(1).max(512),
});

const ClaudeNotificationHook = z.object({
  ...commonShape,
  hook_event_name: z.literal("Notification"),
  message: z.string().max(65_536),
  title: z.string().max(4_096).optional(),
  notification_type: z.enum([
    "permission_prompt",
    "elicitation_dialog",
    "elicitation_url_dialog",
    "agent_needs_input",
  ]),
});

export const ClaudeCodeHook = z.discriminatedUnion("hook_event_name", [
  ClaudeStopHook,
  ClaudeFailureHook,
  ClaudeInputHook,
  ClaudeNotificationHook,
]);

export type ClaudeCodeHook = z.infer<typeof ClaudeCodeHook>;

const notificationId = ({
  event,
  hookId,
  sessionId,
}: {
  event: string;
  hookId: string;
  sessionId: string;
}): string =>
  `claude-${event}-${createHash("sha256")
    .update(`${sessionId}\0${hookId}`)
    .digest("hex")
    .slice(0, 32)}`;

const createNotification = (input: unknown): NotifyInput => {
  const hook = ClaudeCodeHook.parse(input);

  switch (hook.hook_event_name) {
    case "Stop":
      return {
        body: agentNotificationBody(hook.last_assistant_message ?? null),
        directory: hook.cwd,
        notificationId: notificationId({
          event: "turn",
          hookId: hook.prompt_id ?? hook.session_id,
          sessionId: hook.session_id,
        }),
        source: { kind: "agent", name: "Claude Code" },
        title: "Claude Code",
      };
    case "StopFailure":
      return {
        body: null,
        directory: hook.cwd,
        notificationId: notificationId({
          event: "failure",
          hookId: hook.prompt_id ?? hook.session_id,
          sessionId: hook.session_id,
        }),
        source: { kind: "agent", name: "Claude Code" },
        title: "Turn stopped with an error.",
      };
    case "PreToolUse":
      return {
        body: null,
        directory: hook.cwd,
        notificationId: notificationId({
          event: "input",
          hookId: hook.tool_use_id,
          sessionId: hook.session_id,
        }),
        source: { kind: "agent", name: "Claude Code" },
        title: "Input required.",
      };
    case "Notification":
      return {
        body: null,
        directory: hook.cwd,
        notificationId: notificationId({
          event: hook.notification_type,
          hookId: hook.prompt_id ?? hook.notification_type,
          sessionId: hook.session_id,
        }),
        source: { kind: "agent", name: "Claude Code" },
        title:
          hook.notification_type === "permission_prompt"
            ? "Approval required."
            : "Input required.",
      };
  }
};

export const claudeCodeHookAdapter = {
  hookSetup: {
    configPath: ".claude/settings.json",
    configure: configureClaudeCodeHooks,
  },
  skillTarget: "claude",
  createNotification,
  reply: "",
} satisfies AgentAdapter;
