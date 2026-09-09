/**
 * @file Prepare agent text for the generic notification contract.
 */
import { MAXIMUM_NOTIFICATION_BODY_CODE_POINT_COUNT } from "../../protocol/notification.js";

export const agentNotificationBody = (value: string | null): string | null => {
  if (value === null) {
    return null;
  }

  const body = value.trim();

  if (body.length === 0) {
    return null;
  }

  return Array.from(body)
    .slice(0, MAXIMUM_NOTIFICATION_BODY_CODE_POINT_COUNT)
    .join("");
};
