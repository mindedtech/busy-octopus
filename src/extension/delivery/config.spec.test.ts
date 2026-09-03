/**
 * @file Verify notification delivery configuration defaults.
 */

import { expect, it } from "vitest";
import {
  NotificationDeliveryConfig,
  type NotificationDeliveryConfigInput,
} from "./config.js";

it("applies delivery defaults", () => {
  expect(
    NotificationDeliveryConfig.parse({
      detail: { enable: undefined },
      focusSuppression: { enable: undefined },
      editor: { enable: undefined },
      windows: {
        notification: {
          enable: undefined,
          sound: { enable: undefined },
        },
        taskbar: { flash: { enable: undefined } },
      },
    } satisfies NotificationDeliveryConfigInput),
  ).toEqual({
    detail: { enable: true },
    focusSuppression: { enable: true },
    editor: { enable: false },
    windows: {
      notification: { enable: true, sound: { enable: false } },
      taskbar: { flash: { enable: true } },
    },
  } satisfies NotificationDeliveryConfig);
});
