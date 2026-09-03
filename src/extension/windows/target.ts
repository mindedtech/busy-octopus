/**
 * @file Build editor protocol targets for Windows toast activation.
 */

import { Uri } from "vscode";
import type { NotificationDeliveryTarget } from "../delivery/adapter.js";

/**
 * Build a VS Code protocol URI for the workspace that emitted a notification.
 */
export const createWorkspaceActivationUri = ({
  target: { authority, path, scheme },
  uriScheme,
}: {
  target: NotificationDeliveryTarget;
  uriScheme: string;
}): string | null => {
  switch (scheme) {
    case "file":
      return Uri.from({
        authority: "file",
        path,
        scheme: uriScheme,
      }).toString();
    case "vscode-remote":
      return Uri.from({
        authority: "vscode-remote",
        path: `/${authority}${path}`,
        scheme: uriScheme,
      }).toString();
    default:
      return null;
  }
};
