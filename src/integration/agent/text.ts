/**
 * @file Prepare agent text for the generic notification contract.
 */

const MAXIMUM_NOTIFICATION_BODY_CODE_POINT_COUNT = 1_024;

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
