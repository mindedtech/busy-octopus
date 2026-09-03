/**
 * @file Notification delivery configuration.
 */

import { z } from "zod";

export const NotificationDeliveryConfig = z
  .strictObject({
    detail: z
      .strictObject({
        enable: z
          .boolean()
          .default(true)
          .describe("Inclusion of notification details in every delivery."),
      })
      .describe("Notification detail settings."),
    focusSuppression: z
      .strictObject({
        enable: z
          .boolean()
          .default(true)
          .describe("Suppression while the VS Code window has focus."),
      })
      .describe("Focus suppression settings."),
    editor: z
      .strictObject({
        enable: z
          .boolean()
          .default(false)
          .describe("Delivery through VS Code information messages."),
      })
      .describe("VS Code editor notification settings."),
    windows: z
      .strictObject({
        notification: z
          .strictObject({
            enable: z
              .boolean()
              .default(true)
              .describe("Delivery through native Windows toast notifications."),
            sound: z
              .strictObject({
                enable: z
                  .boolean()
                  .default(false)
                  .describe("Default Windows notification sound playback."),
              })
              .describe("Native Windows toast sound settings."),
          })
          .describe("Native Windows toast settings."),
        taskbar: z
          .strictObject({
            flash: z
              .strictObject({
                enable: z
                  .boolean()
                  .default(true)
                  .describe("Windows taskbar flashing."),
              })
              .describe("Windows taskbar flash settings."),
          })
          .describe("Windows taskbar attention settings."),
      })
      .describe("Native Windows delivery settings."),
  })
  .describe("Notification delivery settings shared by all adapters.");

export type NotificationDeliveryConfig = z.infer<
  typeof NotificationDeliveryConfig
>;

export type NotificationDeliveryConfigInput = z.input<
  typeof NotificationDeliveryConfig
>;
