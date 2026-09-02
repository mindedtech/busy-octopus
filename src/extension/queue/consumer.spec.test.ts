/**
 * @file Verify queue polling, ownership, cancellation, and failure isolation.
 */

import { describe, expect, it, vi } from "vitest";
import { createNotificationRequest } from "../../protocol/notification.js";
import { WorkspaceQueueConsumer } from "./consumer.js";

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
    const complete = vi.fn();
    const onRequest = vi.fn().mockResolvedValue(undefined);
    const queue = {
      claim: vi.fn().mockResolvedValue({
        abandon: vi.fn(),
        complete,
        request,
      }),
    };

    const consumer = new WorkspaceQueueConsumer({
      diagnose: vi.fn(),
      intervalMilliseconds: 1_000,
      onRequest,
      queue,
      schedule: () => ({ dispose: vi.fn() }),
    });

    await vi.waitFor(() => expect(complete).toHaveBeenCalledOnce());

    expect(onRequest).toHaveBeenCalledWith(request, expect.any(AbortSignal));
    consumer.dispose();
  });

  it("abandons a request when its consumer fails", async () => {
    const abandon = vi.fn();
    const diagnose = vi.fn();
    const queue = {
      claim: vi.fn().mockResolvedValue({
        abandon,
        complete: vi.fn(),
        request,
      }),
    };

    const consumer = new WorkspaceQueueConsumer({
      diagnose,
      intervalMilliseconds: 1_000,
      onRequest: vi.fn().mockRejectedValue(new Error("synthetic failure")),
      queue,
      schedule: () => ({ dispose: vi.fn() }),
    });

    await vi.waitFor(() => expect(abandon).toHaveBeenCalledOnce());

    expect(diagnose).toHaveBeenCalledWith("request-consumer-error");
    consumer.dispose();
  });

  it("abandons a claim that arrives after disposal", async () => {
    const abandon = vi.fn();
    const claim = Promise.withResolvers<{
      abandon: () => Promise<void>;
      complete: () => Promise<void>;
      request: typeof request;
    } | null>();
    const consumer = new WorkspaceQueueConsumer({
      diagnose: vi.fn(),
      intervalMilliseconds: 1_000,
      onRequest: vi.fn(),
      queue: { claim: () => claim.promise },
      schedule: () => ({ dispose: vi.fn() }),
    });

    consumer.dispose();
    claim.resolve({ abandon, complete: vi.fn(), request });
    await vi.waitFor(() => expect(abandon).toHaveBeenCalledOnce());
  });

  it("reports queue access failures without rejecting the timer callback", async () => {
    const diagnose = vi.fn();

    const consumer = new WorkspaceQueueConsumer({
      diagnose,
      intervalMilliseconds: 1_000,
      onRequest: vi.fn(),
      queue: {
        claim: vi.fn().mockRejectedValue(new Error("synthetic failure")),
      },
      schedule: () => ({ dispose: vi.fn() }),
    });

    await vi.waitFor(() =>
      expect(diagnose).toHaveBeenCalledWith("queue-access-error"),
    );

    consumer.dispose();
  });
});
