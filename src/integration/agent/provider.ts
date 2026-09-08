/**
 * @file Supported agent hook providers and their adapters.
 */

import { z } from "zod";
import type { AgentHookAdapter } from "./adapter.js";
import { claudeCodeHookAdapter } from "./claude-code/adapter.js";
import { codexHookAdapter } from "./codex/adapter.js";

export const AgentProvider = z.enum(["codex", "claude-code"]);

export type AgentProvider = z.infer<typeof AgentProvider>;

const adapterMap = {
  "claude-code": claudeCodeHookAdapter,
  codex: codexHookAdapter,
} satisfies Record<AgentProvider, AgentHookAdapter>;

/**
 * Select the adapter for an agent provider.
 */
export const selectAgentHookAdapter = (
  provider: AgentProvider,
): AgentHookAdapter => adapterMap[provider];
