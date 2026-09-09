/**
 * @file Define the Busy Octopus command-line interface.
 */

import { Command } from "@commander-js/extra-typings";
import { agentCommand } from "./agent.js";
import { doctorCommand } from "./doctor.js";
import { notifyCommand } from "./notify.js";

export const program = new Command()
  .name("busy-octopus")
  .description("Notify when an agent or workspace needs your attention.")
  .action(() => {
    program.help();
  })
  .addCommand(agentCommand)
  .addCommand(notifyCommand)
  .addCommand(doctorCommand);
