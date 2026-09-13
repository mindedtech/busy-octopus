/**
 * @file Agent integration command group.
 */

import { Command } from "@commander-js/extra-typings";
import { agentHookCommand } from "./agent/hook.js";
import { agentSetupCommand } from "./agent/setup.js";
import { agentSkillCommand } from "./agent/skill.js";

export const agentCommand = new Command("agent")
  .description("Configure agent notifications and receive lifecycle hooks.")
  .action(() => {
    agentCommand.help();
  })
  .addCommand(agentHookCommand)
  .addCommand(agentSetupCommand)
  .addCommand(agentSkillCommand);
