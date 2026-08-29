/**
 * @file Create synthetic notification requests for queue tests.
 */

import type { NotificationRequest } from "../../protocol/notification.js";

export const REFERENCE_TIME = "2026-08-28T12:34:56.789Z";

export const createRequest = ({
  creationTime = REFERENCE_TIME,
  notificationId = "synthetic-notification",
}: {
  creationTime?: string;
  notificationId?: string;
} = {}): NotificationRequest => ({
  schemaVersion: 1,
  notificationId,
  creationTime,
  title: "Synthetic task finished",
  body: "Review the synthetic result.",
  workspace: {
    instanceId: "a".repeat(64),
    display: { label: "synthetic-workspace", branch: "feature/example" },
  },
  source: { kind: "test", name: "Synthetic runner" },
});
