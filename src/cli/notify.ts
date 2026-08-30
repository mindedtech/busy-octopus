/**
 * @file Define the command that publishes a notification.
 */

import { Command } from "@commander-js/extra-typings";
import { notify } from "../library/notify.js";

export const notifyCommand = new Command("notify")
  .description("Publish a notification for a workspace.")
  .requiredOption("--title <text>", "Notification title.")
  .option("--body <text>", "Notification details.")
  .option(
    "--directory <path>",
    "Workspace directory. Defaults to the current directory.",
  )
  .option("--notification-id <id>", "Stable identifier for retries.")
  .option("--source-kind <kind>", "Source kind. Requires --source-name.")
  .option("--source-name <name>", "Source name. Requires --source-kind.")
  .action(
    async (
      { body, directory, notificationId, sourceKind, sourceName, title },
      command,
    ) => {
      if ((sourceKind === undefined) !== (sourceName === undefined)) {
        command.error(
          "Source kind and source name must be specified together.",
        );
      }
      try {
        console.log(
          (
            await notify({
              body: body ?? null,
              source:
                sourceKind === undefined || sourceName === undefined
                  ? null
                  : { kind: sourceKind, name: sourceName },
              title,
              ...(directory === undefined ? {} : { directory }),
              ...(notificationId === undefined ? {} : { notificationId }),
            })
          ).notificationId,
        );
      } catch {
        command.error("busy-octopus: unable to publish the notification.", {
          code: "busy-octopus.publish",
          exitCode: 1,
        });
      }
    },
  );
