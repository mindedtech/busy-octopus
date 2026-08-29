/**
 * @file Define generic versioned notification requests and their JSON codec.
 */

import { ok } from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { boundText } from "./text.js";
import { WorkspaceContext } from "./workspace.js";

export const MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT = 4_096;

const utf8Encoder = new TextEncoder();

const NotificationIdentifier = boundText({
  domain: "Notification identifier",
  maximumCodePointCount: 128,
}).describe("Identify a notification for duplicate suppression.");

const NotificationTitle = boundText({
  domain: "Notification title",
  maximumCodePointCount: 120,
}).describe("Provide the primary notification text.");

const NotificationBody = boundText({
  domain: "Notification body",
  maximumCodePointCount: 1_024,
})
  .nullable()
  .describe("Provide notification detail when available.");

const NotificationTimestamp = z.iso
  .datetime({ precision: 3 })
  .refine(
    (value) => {
      const timestamp = new Date(value);

      return (
        !Number.isNaN(timestamp.valueOf()) && timestamp.toISOString() === value
      );
    },
    { error: "Notification timestamp must be a canonical UTC instant." },
  )
  .describe(
    "Record creation time as canonical UTC with millisecond precision.",
  );

export const NotificationSource = z
  .strictObject({
    kind: boundText({
      domain: "Notification source kind",
      maximumCodePointCount: 64,
    }).describe("Classify the generic source of a notification."),
    name: boundText({
      domain: "Notification source name",
      maximumCodePointCount: 120,
    }).describe("Name the source for user-visible context."),
  })
  .describe(
    "Describe a notification source without integration-specific data.",
  );

export type NotificationSource = z.infer<typeof NotificationSource>;

export const NotificationRequestInput = z
  .strictObject({
    notificationId: NotificationIdentifier.optional().describe(
      "Provide a retry-stable identifier or request generation by omission.",
    ),
    title: NotificationTitle,
    body: NotificationBody,
    workspace: WorkspaceContext,
    source: NotificationSource.nullable().describe(
      "Describe the notification source when available.",
    ),
  })
  .describe("Provide caller-owned notification request data.");

export type NotificationRequestInput = z.infer<typeof NotificationRequestInput>;

export const NotificationRequest = z
  .strictObject({
    schemaVersion: z
      .literal(1)
      .describe("Select notification request protocol version 1."),
    notificationId: NotificationIdentifier,
    creationTime: NotificationTimestamp,
    title: NotificationTitle,
    body: NotificationBody,
    workspace: WorkspaceContext,
    source: NotificationSource.nullable().describe(
      "Describe the notification source when available.",
    ),
  })
  .refine(
    (request) =>
      utf8Encoder.encode(JSON.stringify(request)).byteLength <=
      MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT,
    {
      error: `Notification request must not exceed ${MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT} UTF-8 bytes.`,
    },
  )
  .describe("Represent a validated version 1 notification request.");

export type NotificationRequest = z.infer<typeof NotificationRequest>;

const NotificationRequestJsonText = z
  .string()
  .refine(
    (requestJson) =>
      utf8Encoder.encode(requestJson).byteLength <=
      MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT,
    {
      error: `Notification request JSON must not exceed ${MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT} UTF-8 bytes.`,
    },
  )
  .describe("Carry a size-bounded notification request as JSON text.");

export const NotificationRequestJson = z
  .codec(NotificationRequestJsonText, z.unknown(), {
    decode: (requestJson, context): unknown => {
      try {
        const request: unknown = JSON.parse(requestJson);
        return request;
      } catch {
        context.issues.push({
          code: "custom",
          input: undefined,
          message: "Notification request is not valid JSON.",
        });
        return z.NEVER;
      }
    },
    encode: (request): string => {
      const requestJson = JSON.stringify(request);
      ok(requestJson !== undefined);
      return requestJson;
    },
  })
  .pipe(NotificationRequest)
  .describe("Encode and decode a version 1 notification request as JSON.");

export type NotificationRequestJson = z.input<typeof NotificationRequestJson>;

/**
 * Create a validated notification request with protocol-owned metadata.
 */
export const createNotificationRequest = (
  input: NotificationRequestInput,
): NotificationRequest => {
  const requestInput = NotificationRequestInput.parse(input);

  return NotificationRequest.parse({
    schemaVersion: 1,
    notificationId: requestInput.notificationId ?? randomUUID(),
    creationTime: new Date().toISOString(),
    title: requestInput.title,
    body: requestInput.body,
    workspace: requestInput.workspace,
    source: requestInput.source,
  });
};
