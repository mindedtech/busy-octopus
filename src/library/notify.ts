/**
 * @file Publish generic notifications for the active workspace.
 */

import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import {
  createNotificationRequest,
  type NotificationRequestInput,
} from "../protocol/notification.js";
import { locateWorkspaceQueue } from "../queue/location.js";
import { nativeQueueFileSystem } from "../queue/native.js";
import { NotificationQueuePublisher } from "../queue/queue.js";
import { resolveWorkspace } from "../workspace/resolution.js";

/**
 * Provide caller-owned notification content and workspace selection.
 */
export type NotifyInput = Omit<NotificationRequestInput, "workspace"> & {
  directory?: string;
};

/**
 * Identify a notification after successful publication.
 */
export type NotifyResult = {
  notificationId: string;
};

/**
 * Publish a notification to the queue for its resolved workspace.
 */
export const notify = async (input: NotifyInput): Promise<NotifyResult> => {
  const { directory, ...requestInput } = input;
  const { context, platform } = await resolveWorkspace(
    directory === undefined ? {} : { directory },
  );
  const request = createNotificationRequest({
    ...requestInput,
    workspace: context,
  });

  await new NotificationQueuePublisher({
    createToken: () => randomBytes(16).toString("hex"),
    directory: locateWorkspaceQueue({
      instanceId: context.instanceId,
      platform,
      temporaryDirectory: tmpdir(),
    }),
    fileSystem: nativeQueueFileSystem,
  }).publish(request);

  return { notificationId: request.notificationId };
};
