/**
 * @file Print or install the Busy Octopus agent skill.
 */

import { stdout } from "node:process";
import { Command } from "@commander-js/extra-typings";
import type { AgentSkillTarget } from "../../integration/agent/skill.js";
import { installAgentSkill } from "../../integration/agent/skill.js";
import { loadAgentSkillText } from "./content.js";

export const agentSkillCommand = new Command("skill")
  .description("Print or install the Busy Octopus agent skill.")
  .option("--agents", "Write the skill to .agents/skills/busy-octopus.", false)
  .option("--claude", "Write the skill to .claude/skills/busy-octopus.", false)
  .action(async ({ agents, claude }, command) => {
    try {
      const agentSkillText = await loadAgentSkillText();
      const targetList: AgentSkillTarget[] = [
        ...(agents ? (["agents"] as const) : []),
        ...(claude ? (["claude"] as const) : []),
      ];

      if (targetList.length === 0) {
        stdout.write(agentSkillText);
        return;
      }

      for (const target of targetList) {
        await installAgentSkill({
          directory: process.cwd(),
          target,
          text: agentSkillText,
        });
      }
    } catch {
      command.error("busy-octopus: unable to install the agent skill.", {
        code: "busy-octopus.agent.skill",
        exitCode: 1,
      });
    }
  });
