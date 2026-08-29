/**
 * @file Suppress recently delivered notification identifiers.
 */

import { ok } from "node:assert/strict";
import { queuePolicy } from "./queue.js";

/**
 * Reserve one identifier until delivery succeeds or returns ownership.
 */
export type DeduplicationClaim = {
  abandon: () => void;
  complete: () => void;
};

/**
 * Suppress notification identifiers within bounded memory and time.
 */
export class NotificationDeduplicator {
  #clock: () => number;
  #entryMap = new Map<string, { timestamp: number }>();
  #lifetimeMilliseconds: number;
  #maximumEntryCount: number;

  constructor({
    clock = Date.now,
    lifetimeMilliseconds = queuePolicy.requestLifetimeMilliseconds,
    maximumEntryCount = queuePolicy.entryCount,
  }: {
    clock?: () => number;
    lifetimeMilliseconds?: number;
    maximumEntryCount?: number;
  } = {}) {
    ok(
      Number.isSafeInteger(lifetimeMilliseconds) && lifetimeMilliseconds >= 0,
      "Deduplication lifetime must be a nonnegative safe integer.",
    );
    ok(
      Number.isSafeInteger(maximumEntryCount) && maximumEntryCount > 0,
      "Maximum deduplication entry count must be a positive safe integer.",
    );
    this.#clock = clock;
    this.#lifetimeMilliseconds = lifetimeMilliseconds;
    this.#maximumEntryCount = maximumEntryCount;
  }

  /**
   * Reserve an unseen identifier for one delivery attempt.
   *
   * @returns Deduplication ownership, or null while the identifier is active.
   */
  claim = (notificationId: string): DeduplicationClaim | null => {
    const now = this.#now();
    for (const [identifier, { timestamp }] of this.#entryMap) {
      if (now - timestamp > this.#lifetimeMilliseconds) {
        this.#entryMap.delete(identifier);
      }
    }

    if (this.#entryMap.has(notificationId)) {
      return null;
    }

    const entry = { timestamp: now };
    this.#entryMap.set(notificationId, entry);
    while (this.#entryMap.size > this.#maximumEntryCount) {
      const identifier = this.#entryMap.keys().next().value;
      if (identifier === undefined) {
        break;
      }
      this.#entryMap.delete(identifier);
    }

    return {
      abandon: () => {
        if (this.#entryMap.get(notificationId) === entry) {
          this.#entryMap.delete(notificationId);
        }
      },
      complete: () => {
        if (this.#entryMap.get(notificationId) === entry) {
          const timestamp = this.#now();
          this.#entryMap.delete(notificationId);
          this.#entryMap.set(notificationId, { timestamp });
        }
      },
    };
  };

  #now = (): number => {
    const now = this.#clock();
    ok(
      Number.isSafeInteger(now) && now >= 0,
      "Deduplication clock must return a nonnegative safe integer.",
    );
    return now;
  };
}
