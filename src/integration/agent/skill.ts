/**
 * @file Install the Busy Octopus skill for supported agent layouts.
 */

import { join } from "node:path";
import { writeTextFile } from "../../file-system/text.js";

export const agentSkillPathMap = {
  agents: ".agents/skills/busy-octopus/SKILL.md",
  claude: ".claude/skills/busy-octopus/SKILL.md",
} as const;

export type AgentSkillTarget = keyof typeof agentSkillPathMap;

/**
 * Install the Busy Octopus skill in one project agent layout.
 */
export const installAgentSkill = async ({
  directory,
  target,
  text,
}: {
  directory: string;
  target: AgentSkillTarget;
  text: string;
}): Promise<void> => {
  const path = join(directory, agentSkillPathMap[target]);

  await writeTextFile({ path, text });
};
