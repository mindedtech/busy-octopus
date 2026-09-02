/**
 * @file Verify independent notification adapter delivery.
 */

import { describe, expect, it, vi } from "vitest";
import { createNotificationRequest } from "../../protocol/notification.js";
import type { NotificationDeliveryConfig } from "./config.js";
import { NotificationDeliveryDispatcher } from "./dispatcher.js";

const request = createNotificationRequest({
  body: "Review the result.",
  notificationId: "synthetic-notification",
  source: null,
  title: "Synthetic notification",
  workspace: {
    display: { branch: null, label: "synthetic-workspace" },
    instanceId: "0".repeat(64),
  },
});

const config = {
  disableDetails: false,
  disableFocusSuppression: false,
  editor: {
    enable: false,
  },
} satisfies NotificationDeliveryConfig;

describe("NotificationDeliveryDispatcher", () => {
  it("continues after an adapter fails", async () => {
    const diagnose = vi.fn();
    const readConfig = vi.fn(() => config);
    const deliver = vi.fn().mockResolvedValue(undefined);
    const dispatcher = new NotificationDeliveryDispatcher({
      adapterList: [
        {
          allow: () => true,
          deliver: vi.fn().mockRejectedValue(new Error("synthetic failure")),
        },
        { allow: () => true, deliver },
      ],
      diagnose,
      readConfig,
      readFocus: () => false,
    });
    const signal = new AbortController().signal;

    await dispatcher.deliver(request, signal);

    expect(readConfig).toHaveBeenCalledOnce();
    expect(deliver).toHaveBeenCalledWith({
      config,
      notification: request,
      signal,
    });
    expect(diagnose).toHaveBeenCalledWith("delivery-adapter-error");
  });

  it("does not report successful adapter delivery as a failure", async () => {
    const diagnose = vi.fn();
    const readConfig = vi.fn(() => config);
    const dispatcher = new NotificationDeliveryDispatcher({
      adapterList: [
        { allow: () => true, deliver: vi.fn().mockResolvedValue(undefined) },
      ],
      diagnose,
      readConfig,
      readFocus: () => false,
    });

    await dispatcher.deliver(request, new AbortController().signal);

    expect(diagnose).not.toHaveBeenCalled();
    expect(readConfig).toHaveBeenCalledOnce();
  });

  it("suppresses routine delivery while the editor has focus", async () => {
    const allow = vi.fn(() => true);
    const deliver = vi.fn().mockResolvedValue(undefined);
    const dispatcher = new NotificationDeliveryDispatcher({
      adapterList: [{ allow, deliver }],
      diagnose: vi.fn(),
      readConfig: () => config,
      readFocus: () => true,
    });

    await dispatcher.deliver(request, new AbortController().signal);

    expect(allow).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
  });

  it("allows explicit focus suppression opt-out", async () => {
    const deliver = vi.fn().mockResolvedValue(undefined);
    const dispatcher = new NotificationDeliveryDispatcher({
      adapterList: [{ allow: () => true, deliver }],
      diagnose: vi.fn(),
      readConfig: () => ({ ...config, disableFocusSuppression: true }),
      readFocus: () => true,
    });
    const signal = new AbortController().signal;

    await dispatcher.deliver(request, signal);

    expect(deliver).toHaveBeenCalledWith({
      config: { ...config, disableFocusSuppression: true },
      notification: request,
      signal,
    });
  });

  it("removes details before adapter delivery", async () => {
    const deliver = vi.fn().mockResolvedValue(undefined);
    const dispatcher = new NotificationDeliveryDispatcher({
      adapterList: [{ allow: () => true, deliver }],
      diagnose: vi.fn(),
      readConfig: () => ({ ...config, disableDetails: true }),
      readFocus: () => false,
    });
    const signal = new AbortController().signal;

    await dispatcher.deliver(request, signal);

    expect(deliver).toHaveBeenCalledWith({
      config: { ...config, disableDetails: true },
      notification: { ...request, body: null },
      signal,
    });
  });

  it("sanitizes content before adapter delivery", async () => {
    const deliver = vi.fn().mockResolvedValue(undefined);
    const dispatcher = new NotificationDeliveryDispatcher({
      adapterList: [{ allow: () => true, deliver }],
      diagnose: vi.fn(),
      readConfig: () => config,
      readFocus: () => false,
    });
    const signal = new AbortController().signal;

    await dispatcher.deliver(
      {
        ...request,
        body: "Review\n\u202ethe result.",
        title: "Agent\tfinished",
      },
      signal,
    );

    expect(deliver).toHaveBeenCalledWith({
      config,
      notification: {
        ...request,
        body: "Review the result.",
        title: "Agent finished",
      },
      signal,
    });
  });

  it("does not deliver through an adapter that rejects config", async () => {
    const allow = vi.fn(() => false);
    const deliver = vi.fn().mockResolvedValue(undefined);
    const dispatcher = new NotificationDeliveryDispatcher({
      adapterList: [{ allow, deliver }],
      diagnose: vi.fn(),
      readConfig: () => config,
      readFocus: () => false,
    });
    const signal = new AbortController().signal;

    await dispatcher.deliver(request, signal);

    expect(allow).toHaveBeenCalledWith(config);
    expect(deliver).not.toHaveBeenCalled();
  });

  it("reads fresh config for each notification", async () => {
    const readConfig = vi.fn(() => config);
    const dispatcher = new NotificationDeliveryDispatcher({
      adapterList: [
        { allow: () => true, deliver: vi.fn().mockResolvedValue(undefined) },
      ],
      diagnose: vi.fn(),
      readConfig,
      readFocus: () => false,
    });
    const signal = new AbortController().signal;

    await dispatcher.deliver(request, signal);
    await dispatcher.deliver(request, signal);

    expect(readConfig).toHaveBeenCalledTimes(2);
  });

  it("reports and propagates config failure", async () => {
    const failure = new Error("synthetic failure");
    const deliver = vi.fn().mockResolvedValue(undefined);
    const diagnose = vi.fn();
    const dispatcher = new NotificationDeliveryDispatcher({
      adapterList: [{ allow: () => true, deliver }],
      diagnose,
      readConfig: () => {
        throw failure;
      },
      readFocus: () => false,
    });

    await expect(
      dispatcher.deliver(request, new AbortController().signal),
    ).rejects.toBe(failure);

    expect(deliver).not.toHaveBeenCalled();
    expect(diagnose).toHaveBeenCalledWith("delivery-configuration-error");
  });

  it("propagates adapter policy failures", async () => {
    const failure = new Error("synthetic failure");
    const deliver = vi.fn().mockResolvedValue(undefined);
    const diagnose = vi.fn();
    const dispatcher = new NotificationDeliveryDispatcher({
      adapterList: [
        {
          allow: () => {
            throw failure;
          },
          deliver: vi.fn().mockResolvedValue(undefined),
        },
        { allow: () => true, deliver },
      ],
      diagnose,
      readConfig: () => config,
      readFocus: () => false,
    });

    await expect(
      dispatcher.deliver(request, new AbortController().signal),
    ).rejects.toBe(failure);

    expect(deliver).not.toHaveBeenCalled();
    expect(diagnose).not.toHaveBeenCalled();
  });
});
