/**
 * @file Run agent hooks without changing the upstream agent result.
 */

import type { NotifyInput, NotifyResult } from "../../library/notify.js";
import { AgentHookJson } from "./input.js";
import { type AgentProvider, selectAgentHookAdapter } from "./provider.js";

/**
 * Publish one agent hook notification while preserving fail-open behavior.
 */
export const runAgentHook = async ({
  notify,
  provider,
  readInput,
  warn,
}: {
  notify: (input: NotifyInput) => Promise<NotifyResult>;
  provider: AgentProvider;
  readInput: () => Promise<string>;
  warn: () => void;
}): Promise<string> => {
  const hookAdapter = selectAgentHookAdapter(provider);

  try {
    const notification = hookAdapter.createNotification(
      AgentHookJson.parse(await readInput()),
    );

    if (notification !== null) {
      await notify(notification);
    }
  } catch {
    warn();
  }

  return hookAdapter.reply;
};
