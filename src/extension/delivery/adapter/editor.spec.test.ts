/**
 * @file Verify editor notification delivery behavior.
 */

import { describe, expect, it, vi } from "vitest";
import { createNotificationRequest } from "../../../protocol/notification.js";
import type { NotificationDeliveryConfig } from "../config.js";
import { EditorNotificationAdapter } from "./editor.js";

const notification = createNotificationRequest({
  body: "Review the result.",
  notificationId: "synthetic-notification",
  source: null,
  title: "Agent finished",
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

describe("EditorNotificationAdapter", () => {
  it("does not allow editor notifications by default", () => {
    const showInformationMessage = vi.fn();
    const adapter = new EditorNotificationAdapter({
      showInformationMessage,
    });

    expect(adapter.allow(config)).toBe(false);
  });

  it("allows enabled editor notifications", () => {
    const adapter = new EditorNotificationAdapter({
      showInformationMessage: vi.fn(),
    });

    expect(
      adapter.allow({
        ...config,
        editor: { enable: true },
      }),
    ).toBe(true);
  });

  it("shows notifications", async () => {
    const showInformationMessage = vi.fn();
    const adapter = new EditorNotificationAdapter({
      showInformationMessage,
    });

    await adapter.deliver({
      config,
      notification,
      signal: new AbortController().signal,
    });

    expect(showInformationMessage).toHaveBeenCalledWith(
      "Agent finished — Review the result.",
    );
  });

  it("shows only the title when details are absent", async () => {
    const showInformationMessage = vi.fn();
    const adapter = new EditorNotificationAdapter({ showInformationMessage });

    await adapter.deliver({
      config,
      notification: { ...notification, body: null },
      signal: new AbortController().signal,
    });

    expect(showInformationMessage).toHaveBeenCalledWith("Agent finished");
  });

  it("does not show a notification after cancellation", async () => {
    const showInformationMessage = vi.fn();
    const abortController = new AbortController();
    const adapter = new EditorNotificationAdapter({
      showInformationMessage,
    });

    abortController.abort();

    await adapter.deliver({
      config,
      notification,
      signal: abortController.signal,
    });

    expect(showInformationMessage).not.toHaveBeenCalled();
  });

  it("delivers a notification without applying routine policy", async () => {
    const showInformationMessage = vi.fn();
    const adapter = new EditorNotificationAdapter({
      showInformationMessage,
    });

    await adapter.deliver({
      config,
      notification: {
        ...notification,
        body: "Notification delivery is working.",
        title: "Busy Octopus",
      },
      signal: new AbortController().signal,
    });

    expect(showInformationMessage).toHaveBeenCalledWith(
      "Busy Octopus — Notification delivery is working.",
    );
  });
});
