/**
 * @file Common notification delivery adapter contract.
 */

import type { Disposable } from "vscode";
import type { NotificationRequest } from "../../protocol/notification.js";
import type { NotificationDeliveryConfig } from "./config.js";

/**
 * VS Code workspace resource associated with a delivery.
 */
export type NotificationDeliveryTarget = {
  /**
   * Remote extension authority, or an empty string for local files.
   */
  authority: string;

  /**
   * Absolute workspace folder or workspace-file path.
   */
  path: string;

  /**
   * VS Code resource scheme used by the source workspace.
   */
  scheme: string;
};

/**
 * Independent notification delivery channel.
 */
export type NotificationDeliveryAdapter = Disposable & {
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

    /**
     * Workspace resource used for host-specific routing.
     */
    target: NotificationDeliveryTarget;
  }) => Promise<void>;
};
