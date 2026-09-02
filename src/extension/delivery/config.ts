/**
 * @file Notification delivery configuration.
 */

import { z } from "zod";

export const NotificationDeliveryConfig = z
  .strictObject({
    disableDetails: z
      .boolean()
      .default(false)
      .describe("Omission of notification details from every delivery."),
    disableFocusSuppression: z
      .boolean()
      .default(false)
      .describe("Delivery while the VS Code window has focus."),
    editor: z
      .strictObject({
        enable: z
          .boolean()
          .default(false)
          .describe("Delivery through VS Code information messages."),
      })
      .describe("VS Code editor notification settings."),
  })
  .describe("Notification delivery settings shared by all adapters.");

export type NotificationDeliveryConfig = z.infer<
  typeof NotificationDeliveryConfig
>;
