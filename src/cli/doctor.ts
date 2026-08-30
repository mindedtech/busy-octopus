/**
 * @file Define the command that checks notification routing.
 */

import { Command } from "@commander-js/extra-typings";
import { resolveWorkspaceQueue } from "../workspace/queue.js";

export const doctorCommand = new Command("doctor")
  .description("Check notification routing for a workspace.")
  .option(
    "--directory <path>",
    "Workspace directory. Defaults to the current directory.",
  )
  .action(async ({ directory }, command) => {
    try {
      await resolveWorkspaceQueue(directory === undefined ? {} : { directory });
      console.log("Workspace resolution: ok");
      console.log("Queue routing: ok");
    } catch {
      command.error("busy-octopus: unable to resolve notification routing.", {
        code: "busy-octopus.doctor",
        exitCode: 1,
      });
    }
  });
