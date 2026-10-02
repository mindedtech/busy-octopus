/**
 * @file Run agent hooks without changing the upstream agent result.
 */

import { ZodError } from "zod";
import type { NotifyInput, NotifyResult } from "../../library/notify.js";
import { AgentHookJson } from "./input.js";
import { type AgentProvider, selectAgentAdapter } from "./provider.js";

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
  warn: (failure: string) => void;
}): Promise<string> => {
  const hookAdapter = selectAgentAdapter(provider);

  try {
    const notification = hookAdapter.createNotification(
      AgentHookJson.parse(await readInput()),
    );

    if (notification !== null) {
      await notify(notification);
    }
  } catch (error) {
    warn(
      error instanceof ZodError
        ? error.issues
            .map(({ code, path }) => `${code} at ${path.join(".") || "(root)"}`)
            .join(", ")
        : error instanceof Error
          ? error.name
          : typeof error,
    );
  }

  return hookAdapter.reply;
};
