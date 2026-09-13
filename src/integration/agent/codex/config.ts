/**
 * @file Update Codex hook configuration without replacing unrelated hooks.
 *
 * @see https://learn.chatgpt.com/docs/hooks
 */

import { z } from "zod";
import type { AgentAdapter } from "../adapter.js";
import type { CodexHook } from "./adapter.js";

const command = "busy-octopus agent hook codex";

const CodexCommandHook = z.object({
  command: z.literal(command),
  timeout: z.number().optional(),
  type: z.literal("command"),
});

type CodexCommandHook = z.infer<typeof CodexCommandHook>;

const CodexHookGroup = z
  .object({
    matcher: z
      .string()
      .optional()
      .refine((v) => v !== undefined),
    hooks: z.array(z.record(z.string(), z.json())),
  })
  .catchall(z.json());

type CodexHookGroup = Pick<z.infer<typeof CodexHookGroup>, "hooks" | "matcher">;

export const CodexConfig = z
  .object({
    hooks: z
      .record(z.string(), z.array(CodexHookGroup))
      .optional()
      .refine((v) => v !== undefined),
  })
  .catchall(z.json())
  .describe("Codex hook configuration.");

export type CodexConfig = z.infer<typeof CodexConfig>;

type CodexHookDefinition = {
  event: CodexHook["hook_event_name"];
  matcher: string | null;
};

const attentionHookList = [
  { event: "PreToolUse", matcher: "^request_user_input(_async)?$" },
] satisfies CodexHookDefinition[];

const hookList = [
  { event: "Stop", matcher: null },
] satisfies CodexHookDefinition[];

const handler = {
  command,
  timeout: 2,
  type: "command",
} satisfies CodexCommandHook;

const ownsHandler = (input: unknown): boolean =>
  CodexCommandHook.safeParse(input).success;

const removeHandler = (group: CodexHookGroup): CodexHookGroup | null => {
  const remainingHookList = group.hooks.filter(
    (candidate) => !ownsHandler(candidate),
  );

  return remainingHookList.length === 0
    ? null
    : { ...group, hooks: remainingHookList };
};

const removeHook = (
  hookMap: Record<string, CodexHookGroup[]>,
): Record<string, CodexHookGroup[]> =>
  Object.fromEntries(
    Object.entries(hookMap).flatMap(([event, groupList]) => {
      const remainingGroupList = groupList
        .map(removeHandler)
        .filter((group) => group !== null);

      return remainingGroupList.length === 0
        ? []
        : [[event, remainingGroupList]];
    }),
  );

const sameMatcher = ({
  group,
  matcher,
}: {
  group: CodexHookGroup;
  matcher: string | null;
}): boolean =>
  matcher === null ? group.matcher === undefined : group.matcher === matcher;

const addHook = ({
  hook: { event, matcher },
  hookMap,
}: {
  hook: CodexHookDefinition;
  hookMap: Record<string, CodexHookGroup[]>;
}): Record<string, CodexHookGroup[]> => {
  const groupList = hookMap[event] ?? [];
  const groupIndex = groupList.findIndex((group) =>
    sameMatcher({ group, matcher }),
  );

  if (groupIndex === -1) {
    return {
      ...hookMap,
      [event]: [
        ...groupList,
        {
          ...(matcher === null ? {} : { matcher }),
          hooks: [handler],
        },
      ],
    };
  }

  return {
    ...hookMap,
    [event]: groupList.map((group, index) =>
      index === groupIndex
        ? { ...group, hooks: [...group.hooks, handler] }
        : group,
    ),
  };
};

/**
 * Apply Busy Octopus hooks to a Codex configuration.
 */
export const configureCodexHooks: AgentAdapter["hookSetup"]["configure"] = ({
  enableAttention,
  input,
}) => {
  const config = CodexConfig.parse(input);
  let hookMap = removeHook(config.hooks ?? {});

  for (const hook of [
    ...hookList,
    ...(enableAttention ? attentionHookList : []),
  ]) {
    hookMap = addHook({ hook, hookMap });
  }

  return { ...config, hooks: hookMap };
};
