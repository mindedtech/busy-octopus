/**
 * @file Native Windows toast notification delivery.
 */

import { ok } from "node:assert/strict";
import type { Disposable } from "vscode";
import type { showWindowsNotification } from "../../../windows/bridge.js";
import { createWorkspaceActivationUri } from "../../../windows/target.js";
import type { NotificationDeliveryAdapter } from "../../adapter.js";

/**
 * Clickable Windows toast adapter.
 */
export class WindowsNotificationAdapter
  implements NotificationDeliveryAdapter, Disposable
{
  #appName: string;
  #scriptPath: string;
  #showNotification: typeof showWindowsNotification;
  #uriScheme: string;

  constructor({
    appName,
    scriptPath,
    showNotification,
    uriScheme,
  }: {
    appName: string;
    scriptPath: string;
    showNotification: typeof showWindowsNotification;
    uriScheme: string;
  }) {
    this.#appName = appName;
    this.#scriptPath = scriptPath;
    this.#showNotification = showNotification;
    this.#uriScheme = uriScheme;
  }

  /**
   * Check whether native Windows notifications are enabled.
   */
  allow: NotificationDeliveryAdapter["allow"] = ({ windows }) =>
    windows.notification.enable;

  /**
   * Show a native Windows notification for its source workspace.
   */
  deliver: NotificationDeliveryAdapter["deliver"] = async ({
    config,
    notification: { body, title },
    signal,
    target,
  }) => {
    const activationUri = createWorkspaceActivationUri({
      target,
      uriScheme: this.#uriScheme,
    });

    ok(
      activationUri !== null,
      "Windows notification delivery requires a local or remote VS Code workspace.",
    );

    await this.#showNotification({
      activationUri,
      appName: this.#appName,
      body,
      scriptPath: this.#scriptPath,
      signal,
      sound: config.windows.notification.sound.enable,
      title,
    });
  };

  /**
   * Dispose this stateless adapter.
   */
  dispose = (): void => undefined;
}
