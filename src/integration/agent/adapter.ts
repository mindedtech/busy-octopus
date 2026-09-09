/**
 * @file Contract for provider-specific agent hook conversion and setup.
 */

import type { JSONType } from "zod";
import type { NotifyInput } from "../../library/notify.js";

/**
 * Provider-specific conversion and configuration of agent hooks.
 */
export type AgentHookAdapter = {
  /**
   * Hooks installed for this provider.
   */
  hookSetup: {
    /**
     * Provider configuration path relative to the workspace.
     */
    configPath: string;

    /**
     * Apply Busy Octopus hooks to the provider configuration.
     */
    configure: (input: {
      enableAttention: boolean;
      input: unknown;
    }) => JSONType;
  };

  /**
   * Convert one provider payload into generic notification input.
   */
  createNotification: (input: unknown) => NotifyInput | null;

  /**
   * Neutral standard output required by the provider hook protocol.
   */
  reply: string;
};
