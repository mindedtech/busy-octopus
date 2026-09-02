/**
 * @file Verify bounded notification duplicate suppression.
 */

import { assert, describe, expect, it } from "vitest";
import {
  type DeduplicationClaim,
  NotificationDeduplicator,
} from "./deduplicator.js";

const claimNotification = (
  deduplicator: NotificationDeduplicator,
  notificationId: string,
): DeduplicationClaim => {
  const claim = deduplicator.claim(notificationId);
  assert(claim !== null, "Expected notification deduplication ownership.");
  return claim;
};

describe("NotificationDeduplicator", () => {
  it("suppresses active and recently completed identifiers", () => {
    let now = 1;
    const deduplicator = new NotificationDeduplicator({
      clock: () => now,
      lifetimeMilliseconds: 10,
    });

    const claim = claimNotification(deduplicator, "notification-1");
    expect(deduplicator.claim("notification-1")).toBeNull();
    claim.complete();
    expect(deduplicator.claim("notification-1")).toBeNull();

    now = 12;
    expect(deduplicator.claim("notification-1")).not.toBeNull();
  });

  it("keeps an identifier through the exact lifetime boundary", () => {
    let now = 1;
    const deduplicator = new NotificationDeduplicator({
      clock: () => now,
      lifetimeMilliseconds: 10,
    });
    claimNotification(deduplicator, "notification-1").complete();

    now = 11;

    expect(deduplicator.claim("notification-1")).toBeNull();
  });

  it("releases an identifier when delivery is abandoned", () => {
    const deduplicator = new NotificationDeduplicator();
    const claim = claimNotification(deduplicator, "notification-1");

    claim.abandon();

    expect(deduplicator.claim("notification-1")).not.toBeNull();
  });

  it("evicts the oldest identifier at its capacity boundary", () => {
    let now = 1;
    const deduplicator = new NotificationDeduplicator({
      clock: () => now,
      maximumEntryCount: 2,
    });
    claimNotification(deduplicator, "notification-1").complete();
    now += 1;
    claimNotification(deduplicator, "notification-2").complete();
    now += 1;
    claimNotification(deduplicator, "notification-3").complete();

    expect(deduplicator.claim("notification-2")).toBeNull();
    expect(deduplicator.claim("notification-3")).toBeNull();
    expect(deduplicator.claim("notification-1")).not.toBeNull();
  });

  it("refreshes completion order before capacity eviction", () => {
    let now = 1;
    const deduplicator = new NotificationDeduplicator({
      clock: () => now,
      maximumEntryCount: 2,
    });
    const first = claimNotification(deduplicator, "notification-1");
    now += 1;
    claimNotification(deduplicator, "notification-2").complete();
    now += 1;
    first.complete();
    now += 1;
    claimNotification(deduplicator, "notification-3").complete();

    expect(deduplicator.claim("notification-1")).toBeNull();
    expect(deduplicator.claim("notification-2")).not.toBeNull();
  });

  it("preserves ownership when the completion clock is invalid", () => {
    let now = 1;
    const deduplicator = new NotificationDeduplicator({ clock: () => now });
    const claim = claimNotification(deduplicator, "notification-1");
    now = -1;

    expect(() => claim.complete()).toThrow(
      "Deduplication clock must return a nonnegative safe integer.",
    );
    now = 2;
    expect(deduplicator.claim("notification-1")).toBeNull();
  });

  it("rejects invalid policy bounds", () => {
    expect(
      () => new NotificationDeduplicator({ lifetimeMilliseconds: -1 }),
    ).toThrow("Deduplication lifetime must be a nonnegative safe integer.");
    expect(
      () => new NotificationDeduplicator({ maximumEntryCount: 0 }),
    ).toThrow(
      "Maximum deduplication entry count must be a positive safe integer.",
    );
  });
});
