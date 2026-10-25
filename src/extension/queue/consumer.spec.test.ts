/**
 * @file Verify queue polling, ownership, cancellation, and failure isolation.
 */

import { describe, expect, it, vi } from "vitest";
import type { Disposable } from "vscode";
import { createNotificationRequest } from "../../protocol/notification.js";
import type { QueueClaim } from "../../queue/queue.js";
import { WorkspaceQueueConsumer } from "./consumer.js";

type ConsumerInput = ConstructorParameters<typeof WorkspaceQueueConsumer>[0];

const request = createNotificationRequest({
  body: null,
  notificationId: "synthetic-notification",
  source: null,
  title: "Synthetic notification",
  workspace: {
    display: { branch: null, label: "synthetic-workspace" },
    instanceId: "0".repeat(64),
  },
});

describe("WorkspaceQueueConsumer", () => {
  it("completes a request after its consumer succeeds", async () => {
    const complete = vi.fn<QueueClaim["complete"]>();
    const onRequest = vi.fn<ConsumerInput["onRequest"]>().mockResolvedValue();
    const queue = {
      claim: vi.fn<ConsumerInput["queue"]["claim"]>().mockResolvedValue({
        abandon: vi.fn<QueueClaim["abandon"]>(),
        complete,
        request,
      }),
    };

    const consumer = new WorkspaceQueueConsumer({
      diagnose: vi.fn<ConsumerInput["diagnose"]>(),
      intervalMilliseconds: 1_000,
      onRequest,
      queue,
      schedule: () => ({ dispose: vi.fn<Disposable["dispose"]>() }),
    });

    await vi.waitFor(() => expect(complete).toHaveBeenCalledOnce());

    expect(onRequest).toHaveBeenCalledWith(request, expect.any(AbortSignal));
    consumer.dispose();
  });

  it("abandons a request when its consumer fails", async () => {
    const abandon = vi.fn<QueueClaim["abandon"]>();
    const diagnose = vi.fn<ConsumerInput["diagnose"]>();
    const queue = {
      claim: vi.fn<ConsumerInput["queue"]["claim"]>().mockResolvedValue({
        abandon,
        complete: vi.fn<QueueClaim["complete"]>(),
        request,
      }),
    };

    const consumer = new WorkspaceQueueConsumer({
      diagnose,
      intervalMilliseconds: 1_000,
      onRequest: vi
        .fn<ConsumerInput["onRequest"]>()
        .mockRejectedValue(new Error("synthetic failure")),
      queue,
      schedule: () => ({ dispose: vi.fn<Disposable["dispose"]>() }),
    });

    await vi.waitFor(() => expect(abandon).toHaveBeenCalledOnce());

    expect(diagnose).toHaveBeenCalledWith("request-consumer-error");
    consumer.dispose();
  });

  it("abandons a claim that arrives after disposal", async () => {
    const abandon = vi.fn<QueueClaim["abandon"]>();
    const claim = Promise.withResolvers<QueueClaim | null>();
    const consumer = new WorkspaceQueueConsumer({
      diagnose: vi.fn<ConsumerInput["diagnose"]>(),
      intervalMilliseconds: 1_000,
      onRequest: vi.fn<ConsumerInput["onRequest"]>(),
      queue: { claim: () => claim.promise },
      schedule: () => ({ dispose: vi.fn<Disposable["dispose"]>() }),
    });

    consumer.dispose();
    claim.resolve({
      abandon,
      complete: vi.fn<QueueClaim["complete"]>(),
      request,
    });
    await vi.waitFor(() => expect(abandon).toHaveBeenCalledOnce());
  });

  it("reports queue access failures without rejecting the timer callback", async () => {
    const diagnose = vi.fn<ConsumerInput["diagnose"]>();

    const consumer = new WorkspaceQueueConsumer({
      diagnose,
      intervalMilliseconds: 1_000,
      onRequest: vi.fn<ConsumerInput["onRequest"]>(),
      queue: {
        claim: vi
          .fn<ConsumerInput["queue"]["claim"]>()
          .mockRejectedValue(new Error("synthetic failure")),
      },
      schedule: () => ({ dispose: vi.fn<Disposable["dispose"]>() }),
    });

    await vi.waitFor(() =>
      expect(diagnose).toHaveBeenCalledWith("queue-access-error"),
    );

    consumer.dispose();
  });
});
