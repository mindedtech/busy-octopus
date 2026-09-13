/**
 * @file Load agent content distributed with the command-line package.
 */

import { readFile } from "node:fs/promises";

const agentSkillUrl = new URL(
  "../../.agents/skills/busy-octopus/SKILL.md",
  import.meta.url,
);

/**
 * Load the canonical Busy Octopus agent skill.
 */
export const loadAgentSkillText = async (): Promise<string> =>
  readFile(agentSkillUrl, "utf8");
