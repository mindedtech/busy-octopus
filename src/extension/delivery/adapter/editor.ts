/**
 * @file Notification delivery through the VS Code message interface.
 */

import type { Disposable, window } from "vscode";
import type { NotificationRequest } from "../../../protocol/notification.js";
import type { NotificationDeliveryAdapter } from "../adapter.js";

/**
 * VS Code information-message notification adapter.
 */
export class EditorNotificationAdapter
  implements NotificationDeliveryAdapter, Disposable
{
  #window: Pick<typeof window, "showInformationMessage">;

  constructor(editorWindow: Pick<typeof window, "showInformationMessage">) {
    this.#window = editorWindow;
  }

  /**
   * Check whether editor notifications are enabled.
   */
  allow: NotificationDeliveryAdapter["allow"] = ({ editor }) => editor.enable;

  /**
   * Show one notification through the VS Code message interface.
   */
  deliver: NotificationDeliveryAdapter["deliver"] = async ({
    notification,
    signal,
  }) => {
    if (signal.aborted) {
      return;
    }

    void this.#window.showInformationMessage(this.#formatMessage(notification));
  };

  /**
   * Dispose this stateless adapter.
   */
  dispose = (): void => undefined;

  #formatMessage = ({ body, title }: NotificationRequest): string => {
    if (body === null) {
      return title;
    }

    return `${title} — ${body}`;
  };
}
