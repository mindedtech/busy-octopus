/**
 * @file Define the Busy Octopus command-line interface.
 */

import { Command } from "@commander-js/extra-typings";
import { agentCommand } from "./agent.js";
import { doctorCommand } from "./doctor.js";
import { notifyCommand } from "./notify.js";
import { runCommand } from "./run.js";

export const program = new Command()
  .name("busy-octopus")
  .enablePositionalOptions()
  .description("Notify when an agent or workspace needs your attention.")
  .action(() => {
    program.help();
  })
  .addCommand(agentCommand)
  .addCommand(doctorCommand)
  .addCommand(notifyCommand)
  .addCommand(runCommand);
