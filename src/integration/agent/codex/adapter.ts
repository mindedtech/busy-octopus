/**
 * @file Convert Codex lifecycle hooks into generic notifications.
 *
 * @see https://learn.chatgpt.com/docs/hooks
 */

import { createHash } from "node:crypto";
import { z } from "zod";
import type { NotifyInput } from "../../../library/notify.js";
import type { AgentHookAdapter } from "../adapter.js";
import { agentNotificationBody } from "../text.js";
import { configureCodexHooks } from "./config.js";

const CodexPermissionMode = z.enum([
  "default",
  "acceptEdits",
  "plan",
  "dontAsk",
  "bypassPermissions",
]);

const commonShape = {
  session_id: z.string().min(1).max(512),
  transcript_path: z.string().max(4_096).nullable(),
  cwd: z.string().min(1).max(4_096),
  model: z.string().min(1).max(256),
  permission_mode: CodexPermissionMode,
  turn_id: z.string().min(1).max(512),
} satisfies z.ZodRawShape;

const CodexStopHook = z.strictObject({
  ...commonShape,
  hook_event_name: z.literal("Stop"),
  stop_hook_active: z.boolean(),
  last_assistant_message: z.string().max(65_536).nullable(),
});

const CodexInputHook = z.strictObject({
  ...commonShape,
  hook_event_name: z.literal("PreToolUse"),
  tool_name: z.enum(["request_user_input", "request_user_input_async"]),
  tool_use_id: z.string().min(1).max(512),
  tool_input: z.unknown(),
});

export const CodexHook = z.discriminatedUnion("hook_event_name", [
  CodexStopHook,
  CodexInputHook,
]);

export type CodexHook = z.infer<typeof CodexHook>;

const notificationId = ({
  event,
  sessionId,
  turnId,
}: {
  event: string;
  sessionId: string;
  turnId: string;
}): string =>
  `codex-${event}-${createHash("sha256")
    .update(`${sessionId}\0${turnId}`)
    .digest("hex")
    .slice(0, 32)}`;

const createNotification = (input: unknown): NotifyInput => {
  const hook = CodexHook.parse(input);

  switch (hook.hook_event_name) {
    case "Stop":
      return {
        body: agentNotificationBody(hook.last_assistant_message),
        directory: hook.cwd,
        notificationId: notificationId({
          event: "turn",
          sessionId: hook.session_id,
          turnId: hook.turn_id,
        }),
        source: { kind: "agent", name: "Codex" },
        title: "Codex",
      };
    case "PreToolUse":
      return {
        body: null,
        directory: hook.cwd,
        notificationId: notificationId({
          event: "input",
          sessionId: hook.session_id,
          turnId: hook.tool_use_id,
        }),
        source: { kind: "agent", name: "Codex" },
        title: "Input required.",
      };
  }
};

export const codexHookAdapter = {
  hookSetup: {
    configPath: ".codex/hooks.json",
    configure: configureCodexHooks,
  },
  createNotification,
  reply: "{}\n",
} satisfies AgentHookAdapter;
