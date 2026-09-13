/**
 * @file Supported agent providers and their adapters.
 */

import { z } from "zod";
import type { AgentAdapter } from "./adapter.js";
import { claudeCodeHookAdapter } from "./claude-code/adapter.js";
import { codexHookAdapter } from "./codex/adapter.js";

export const AgentProvider = z.enum(["codex", "claude-code"]);

export type AgentProvider = z.infer<typeof AgentProvider>;

const adapterMap = {
  "claude-code": claudeCodeHookAdapter,
  codex: codexHookAdapter,
} satisfies Record<AgentProvider, AgentAdapter>;

/**
 * Select the adapter for an agent provider.
 */
export const selectAgentAdapter = (provider: AgentProvider): AgentAdapter =>
  adapterMap[provider];
