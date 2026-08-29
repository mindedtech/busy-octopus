/**
 * @file Verify generic notification request and JSON codec behavior.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createNotificationRequest,
  MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT,
  NotificationRequest,
  type NotificationRequestInput,
  NotificationRequestJson,
  NotificationSource,
} from "./notification.js";

const REFERENCE_TIMESTAMP = "2026-08-28T12:34:56.789Z";
const utf8Encoder = new TextEncoder();

const createInput = (): NotificationRequestInput => ({
  notificationId: "notification-fixture",
  title: "Fixture title",
  body: "Fixture body",
  workspace: {
    instanceId: "workspace-fixture",
    display: {
      label: "Fixture workspace",
      branch: "feature/fixture",
    },
  },
  source: {
    kind: "fixture",
    name: "Fixture source",
  },
});

const createRequest = (): NotificationRequest => ({
  schemaVersion: 1,
  notificationId: "notification-fixture",
  creationTime: REFERENCE_TIMESTAMP,
  title: "Fixture title",
  body: "Fixture body",
  workspace: {
    instanceId: "workspace-fixture",
    display: {
      label: "Fixture workspace",
      branch: "feature/fixture",
    },
  },
  source: {
    kind: "fixture",
    name: "Fixture source",
  },
});

const createRequestAtByteCount = (
  targetByteCount: number,
): NotificationRequest => {
  const request = createRequest();
  const baselineJson = JSON.stringify({ ...request, body: "" });
  const bodyByteCount =
    targetByteCount - utf8Encoder.encode(baselineJson).byteLength;
  const fourByteCodePointCount = Math.floor(bodyByteCount / 4);
  const singleByteCodePointCount = bodyByteCount % 4;
  const body =
    "😀".repeat(fourByteCodePointCount) + "a".repeat(singleByteCodePointCount);

  return { ...request, body };
};

const createRequestJsonAtByteCount = (
  targetByteCount: number,
): NotificationRequestJson =>
  JSON.stringify(createRequestAtByteCount(targetByteCount));

afterEach(() => {
  vi.useRealTimers();
});

describe("createNotificationRequest", () => {
  it("uses explicit retry-stable identifiers and canonical current time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(REFERENCE_TIMESTAMP));

    expect(createNotificationRequest(createInput())).toEqual(createRequest());
  });

  it("generates a notification identifier when omitted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(REFERENCE_TIMESTAMP));
    const { notificationId: _notificationId, ...input } = createInput();

    const request = createNotificationRequest(input);

    expect(z.uuid().safeParse(request.notificationId).success).toBe(true);
    expect(request.creationTime).toBe(REFERENCE_TIMESTAMP);
  });

  it("rejects unknown creation input fields", () => {
    const input = {
      ...createInput(),
      integrationPayload: "synthetic",
    };

    expect(() => createNotificationRequest(input)).toThrow();
  });
});

describe("NotificationSource", () => {
  it("validates the standalone strict source contract", () => {
    expect(
      NotificationSource.safeParse({
        kind: "fixture",
        name: "Fixture source",
      }).success,
    ).toBe(true);
    expect(NotificationSource.safeParse(null).success).toBe(false);
  });
});

describe("NotificationRequest", () => {
  it("accepts full and explicit-null request forms", () => {
    expect(NotificationRequest.safeParse(createRequest()).success).toBe(true);
    expect(
      NotificationRequest.safeParse({
        ...createRequest(),
        body: null,
        workspace: {
          instanceId: "workspace-fixture",
          display: { label: null, branch: null },
        },
        source: null,
      }).success,
    ).toBe(true);
  });

  it.each([
    ["notification identifier", { notificationId: "a".repeat(128) }],
    ["title", { title: "a".repeat(120) }],
    ["body", { body: "a".repeat(1_024) }],
    [
      "source fields",
      {
        source: {
          kind: "a".repeat(64),
          name: "a".repeat(120),
        },
      },
    ],
  ])("accepts exact %s text boundaries", (_domain, replacement) => {
    expect(
      NotificationRequest.safeParse({
        ...createRequest(),
        ...replacement,
      }).success,
    ).toBe(true);
  });

  it.each([
    ["notification identifier", { notificationId: "a".repeat(129) }],
    ["title", { title: "a".repeat(121) }],
    ["body", { body: "a".repeat(1_025) }],
    [
      "source kind",
      { source: { kind: "a".repeat(65), name: "Fixture source" } },
    ],
    ["source name", { source: { kind: "fixture", name: "a".repeat(121) } }],
  ])("rejects overflowing %s text", (_domain, replacement) => {
    expect(
      NotificationRequest.safeParse({
        ...createRequest(),
        ...replacement,
      }).success,
    ).toBe(false);
  });

  it.each([
    ["notification identifier", { notificationId: "   " }],
    ["title", { title: "\t" }],
    ["body", { body: "\n" }],
    ["source kind", { source: { kind: " ", name: "Fixture source" } }],
    ["source name", { source: { kind: "fixture", name: " " } }],
  ])("rejects blank %s text", (_domain, replacement) => {
    expect(
      NotificationRequest.safeParse({
        ...createRequest(),
        ...replacement,
      }).success,
    ).toBe(false);
  });

  it.each([
    ["missing", { ...createRequest(), schemaVersion: undefined }],
    ["unknown", { ...createRequest(), schemaVersion: 2 }],
    ["wrong type", { ...createRequest(), schemaVersion: "1" }],
  ])("rejects a %s schema version", (_domain, request) => {
    expect(NotificationRequest.safeParse(request).success).toBe(false);
  });

  it.each([
    "2026-02-30T12:34:56.789Z",
    "2026-08-28T12:34:56Z",
    "2026-08-28T12:34:56.7890Z",
    "2026-08-28T12:34:56.789+00:00",
    "2026-08-28t12:34:56.789z",
  ])("rejects noncanonical timestamp %s", (creationTime) => {
    expect(
      NotificationRequest.safeParse({
        ...createRequest(),
        creationTime,
      }).success,
    ).toBe(false);
  });

  it("requires explicit nullable fields", () => {
    const request = {
      missingBody: {
        schemaVersion: 1,
        notificationId: "notification-fixture",
        creationTime: REFERENCE_TIMESTAMP,
        title: "Fixture title",
        workspace: createRequest().workspace,
        source: null,
      },
      missingSource: {
        schemaVersion: 1,
        notificationId: "notification-fixture",
        creationTime: REFERENCE_TIMESTAMP,
        title: "Fixture title",
        body: null,
        workspace: createRequest().workspace,
      },
    };

    expect(NotificationRequest.safeParse(request.missingBody).success).toBe(
      false,
    );
    expect(NotificationRequest.safeParse(request.missingSource).success).toBe(
      false,
    );
  });

  it("rejects unknown request and source fields", () => {
    expect(
      NotificationRequest.safeParse({
        ...createRequest(),
        deliveryHint: "synthetic",
      }).success,
    ).toBe(false);
    expect(
      NotificationRequest.safeParse({
        ...createRequest(),
        source: {
          kind: "fixture",
          name: "Fixture source",
          payload: "synthetic",
        },
      }).success,
    ).toBe(false);
  });
});

describe("NotificationRequestJson", () => {
  it.each([
    ["array", "[]"],
    ["primitive", "42"],
    ["null", "null"],
  ])("rejects a raw JSON %s", (_domain, input) => {
    expect(() => NotificationRequestJson.decode(input)).toThrow();
  });

  it("returns a content-free error for malformed JSON", () => {
    expect(() => NotificationRequestJson.decode('{"fixture":')).toThrow(
      "Notification request is not valid JSON.",
    );
  });

  it("accepts an exact 4096-byte compact request", () => {
    const input = createRequestJsonAtByteCount(
      MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT,
    );

    expect(utf8Encoder.encode(input).byteLength).toBe(
      MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT,
    );
    expect(NotificationRequestJson.decode(input).body).not.toBeNull();
  });

  it("rejects a request one byte over the limit", () => {
    const input = createRequestJsonAtByteCount(
      MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT + 1,
    );

    expect(utf8Encoder.encode(input).byteLength).toBe(
      MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT + 1,
    );
    expect(() => NotificationRequestJson.decode(input)).toThrow(
      `Notification request JSON must not exceed ${MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT} UTF-8 bytes.`,
    );
  });

  it("applies the compact size limit to object parsing and serialization", () => {
    const request = createRequestAtByteCount(
      MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT + 1,
    );

    expect(() => NotificationRequest.parse(request)).toThrow();
    expect(() => NotificationRequestJson.encode(request)).toThrow();
  });

  it("checks raw size before parsing malformed JSON", () => {
    const invalidJson = `{"value":"${"a".repeat(
      MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT,
    )}`;

    expect(() => NotificationRequestJson.decode(invalidJson)).toThrow(
      `Notification request JSON must not exceed ${MAXIMUM_NOTIFICATION_REQUEST_BYTE_COUNT} UTF-8 bytes.`,
    );
  });

  it("preserves accepted text through compact serialization", () => {
    const request = {
      ...createRequest(),
      title: "  Fixture title  ",
      body: "First line\nSecond line <>&",
    };
    const requestJson = NotificationRequestJson.encode(request);

    expect(requestJson).toBe(JSON.stringify(request));
    expect(NotificationRequestJson.decode(requestJson)).toEqual(request);
  });
});
