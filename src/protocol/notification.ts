/**
 * @file Generic versioned notification requests and their JSON codec.
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
}).describe("Stable notification identity for duplicate suppression.");

const NotificationTitle = boundText({
  domain: "Notification title",
  maximumCodePointCount: 120,
}).describe("Primary notification text.");

const NotificationBody = boundText({
  domain: "Notification body",
  maximumCodePointCount: 1_024,
})
  .nullable()
  .describe("Notification detail when available.");

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
  .describe("Canonical UTC creation time with millisecond precision.");

export const NotificationSource = z
  .strictObject({
    kind: boundText({
      domain: "Notification source kind",
      maximumCodePointCount: 64,
    }).describe("Generic notification source category."),
    name: boundText({
      domain: "Notification source name",
      maximumCodePointCount: 120,
    }).describe("User-visible notification source name."),
  })
  .describe("Notification source without integration-specific data.");

export type NotificationSource = z.infer<typeof NotificationSource>;

export const NotificationRequestInput = z
  .strictObject({
    notificationId: NotificationIdentifier.optional().describe(
      "Retry-stable identifier; omission requests identifier generation.",
    ),
    title: NotificationTitle,
    body: NotificationBody,
    workspace: WorkspaceContext,
    source: NotificationSource.nullable().describe(
      "Notification source when available.",
    ),
  })
  .describe("Caller-owned notification request data.");

export type NotificationRequestInput = z.infer<typeof NotificationRequestInput>;

export const NotificationRequest = z
  .strictObject({
    schemaVersion: z
      .literal(1)
      .describe("Notification request protocol version 1."),
    notificationId: NotificationIdentifier,
    creationTime: NotificationTimestamp,
    title: NotificationTitle,
    body: NotificationBody,
    workspace: WorkspaceContext,
    source: NotificationSource.nullable().describe(
      "Notification source when available.",
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
  .describe("Validated version 1 notification request.");

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
  .describe("Size-bounded notification request JSON text.");

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
  .describe("Version 1 notification request JSON codec.");

export type NotificationRequestJson = z.input<typeof NotificationRequestJson>;

const NotificationRequestCreation = NotificationRequestInput.transform(
  ({ body, notificationId, source, title, workspace }) => ({
    schemaVersion: 1 as const,
    notificationId: notificationId ?? randomUUID(),
    creationTime: new Date().toISOString(),
    title,
    body,
    workspace,
    source,
  }),
).pipe(NotificationRequest);

/**
 * Create a validated notification request with protocol-owned metadata.
 */
export const createNotificationRequest = (
  input: NotificationRequestInput,
): NotificationRequest => NotificationRequestCreation.parse(input);
