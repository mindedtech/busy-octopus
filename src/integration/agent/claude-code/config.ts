/**
 * @file Update Claude Code hook configuration without replacing unrelated hooks.
 *
 * @see https://code.claude.com/docs/en/hooks
 */

import { z } from "zod";
import type { AgentHookAdapter } from "../adapter.js";
import type { ClaudeCodeHook } from "./adapter.js";

const command = "busy-octopus agent hook claude-code";

const ClaudeCodeCommandHook = z.object({
  command: z.literal(command),
  timeout: z.number().optional(),
  type: z.literal("command"),
});

type ClaudeCodeCommandHook = z.infer<typeof ClaudeCodeCommandHook>;

const ClaudeCodeHookGroup = z
  .object({
    matcher: z
      .string()
      .optional()
      .refine((v) => v !== undefined),
    hooks: z.array(z.record(z.string(), z.json())),
  })
  .catchall(z.json());

type ClaudeCodeHookGroup = Pick<
  z.infer<typeof ClaudeCodeHookGroup>,
  "hooks" | "matcher"
>;

export const ClaudeCodeConfig = z
  .object({
    hooks: z.record(z.string(), z.array(ClaudeCodeHookGroup)).optional(),
  })
  .catchall(z.json())
  .describe("Claude Code hook configuration.");

export type ClaudeCodeConfig = z.infer<typeof ClaudeCodeConfig>;

type ClaudeCodeHookDefinition = {
  event: ClaudeCodeHook["hook_event_name"];
  matcher: string | null;
};

const attentionHookList = [
  { event: "PreToolUse", matcher: "AskUserQuestion" },
  { event: "Notification", matcher: "permission_prompt" },
  {
    event: "Notification",
    matcher: "elicitation_dialog|elicitation_url_dialog|agent_needs_input",
  },
] satisfies ClaudeCodeHookDefinition[];

const hookList = [
  { event: "Stop", matcher: null },
  { event: "StopFailure", matcher: null },
] satisfies ClaudeCodeHookDefinition[];

const handler = {
  command,
  timeout: 2,
  type: "command",
} satisfies ClaudeCodeCommandHook;

const ownsHandler = (input: unknown): boolean =>
  ClaudeCodeCommandHook.safeParse(input).success;

const removeHandler = (
  group: ClaudeCodeHookGroup,
): ClaudeCodeHookGroup | null => {
  const remainingHookList = group.hooks.filter(
    (candidate) => !ownsHandler(candidate),
  );

  return remainingHookList.length === 0
    ? null
    : { ...group, hooks: remainingHookList };
};

const removeHook = (
  hookMap: Record<string, ClaudeCodeHookGroup[]>,
): Record<string, ClaudeCodeHookGroup[]> =>
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
  group: ClaudeCodeHookGroup;
  matcher: string | null;
}): boolean =>
  matcher === null ? group.matcher === undefined : group.matcher === matcher;

const addHook = ({
  hook: { event, matcher },
  hookMap,
}: {
  hook: ClaudeCodeHookDefinition;
  hookMap: Record<string, ClaudeCodeHookGroup[]>;
}): Record<string, ClaudeCodeHookGroup[]> => {
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
 * Apply Busy Octopus hooks to a Claude Code configuration.
 */
export const configureClaudeCodeHooks: AgentHookAdapter["hookSetup"]["configure"] =
  ({ enableAttention, input }) => {
    const config = ClaudeCodeConfig.parse(input);
    let hookMap = removeHook(config.hooks ?? {});

    for (const hook of [
      ...hookList,
      ...(enableAttention ? attentionHookList : []),
    ]) {
      hookMap = addHook({ hook, hookMap });
    }

    return { ...config, hooks: hookMap };
  };
