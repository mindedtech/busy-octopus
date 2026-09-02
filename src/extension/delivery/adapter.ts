/**
 * @file Common notification delivery adapter contract.
 */

import type { NotificationRequest } from "../../protocol/notification.js";
import type { NotificationDeliveryConfig } from "./config.js";

/**
 * Independent notification delivery channel.
 */
export type NotificationDeliveryAdapter = {
  /**
   * Check whether the current configuration enables this adapter.
   */
  allow: (config: NotificationDeliveryConfig) => boolean;

  /**
   * Deliver one notification through this adapter.
   */
  deliver: (input: {
    /**
     * Configuration snapshot shared by every adapter for this delivery.
     */
    config: NotificationDeliveryConfig;

    /**
     * Notification content prepared for delivery.
     */
    notification: NotificationRequest;

    /**
     * Cancellation signal for delivery work.
     */
    signal: AbortSignal;
  }) => Promise<void>;
};
