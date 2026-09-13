/**
 * @file Provider-specific agent notification integration contract.
 */

import type { JSONType } from "zod";
import type { NotifyInput } from "../../library/notify.js";
import type { AgentSkillTarget } from "./skill.js";

/**
 * Provider-specific agent notification integration.
 */
export type AgentAdapter = {
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
   * Project skill layout used by the provider.
   */
  skillTarget: AgentSkillTarget;

  /**
   * Convert one provider payload into generic notification input.
   */
  createNotification: (input: unknown) => NotifyInput | null;

  /**
   * Neutral standard output required by the provider hook protocol.
   */
  reply: string;
};
