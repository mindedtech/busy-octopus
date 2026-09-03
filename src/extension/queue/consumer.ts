/**
 * @file Poll one workspace queue through an explicit lifecycle owner.
 */

import type { Disposable } from "vscode";
import type { NotificationRequest } from "../../protocol/notification.js";
import type { NotificationQueue } from "../../queue/queue.js";
import type { DiagnosticCode } from "../diagnostic.js";

/**
 * Claim one request at a time and release ownership on consumer failure.
 */
export class WorkspaceQueueConsumer implements Disposable {
  #abortController = new AbortController();
  #active = false;
  #diagnose: (code: DiagnosticCode) => void;
  #onRequest: (
    request: NotificationRequest,
    signal: AbortSignal,
  ) => Promise<void>;
  #queue: Pick<NotificationQueue<unknown>, "claim">;
  #timer: Disposable;

  constructor({
    diagnose,
    intervalMilliseconds,
    onRequest,
    queue,
    schedule,
  }: {
    diagnose: (code: DiagnosticCode) => void;
    intervalMilliseconds: number;
    onRequest: (
      request: NotificationRequest,
      signal: AbortSignal,
    ) => Promise<void>;
    queue: Pick<NotificationQueue<unknown>, "claim">;
    schedule: (
      callback: () => Promise<void>,
      intervalMilliseconds: number,
    ) => Disposable;
  }) {
    this.#diagnose = diagnose;
    this.#onRequest = onRequest;
    this.#queue = queue;
    this.#timer = schedule(this.#poll, intervalMilliseconds);

    void this.#poll();
  }

  dispose = (): void => {
    this.#abortController.abort();
    this.#timer.dispose();
  };

  #poll = async (): Promise<void> => {
    if (this.#active || this.#abortController.signal.aborted) {
      return;
    }

    this.#active = true;
    try {
      const claim = await this.#queue.claim();
      if (claim === null) {
        return;
      }
      if (this.#abortController.signal.aborted) {
        await this.#release(claim.abandon);
        return;
      }

      try {
        await this.#onRequest(claim.request, this.#abortController.signal);
      } catch {
        this.#diagnose("request-consumer-error");
        await this.#release(claim.abandon);
        return;
      }

      await claim.complete();
    } catch {
      this.#diagnose("queue-access-error");
    } finally {
      this.#active = false;
    }
  };

  #release = async (abandon: () => Promise<void>): Promise<void> => {
    try {
      await abandon();
    } catch {
      this.#diagnose("claim-release-error");
    }
  };
}
