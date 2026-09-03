/**
 * @file Verify native Windows toast adapter behavior.
 */

import { describe, expect, it, vi } from "vitest";
import { createNotificationRequest } from "../../../../protocol/notification.js";
import type { showWindowsNotification } from "../../../windows/bridge.js";
import type { NotificationDeliveryTarget } from "../../adapter.js";
import type { NotificationDeliveryConfig } from "../../config.js";
import { WindowsNotificationAdapter } from "./notification.js";

vi.mock("vscode", () => ({
  Uri: {
    from: ({
      authority,
      path,
      scheme,
    }: {
      authority: string;
      path: string;
      scheme: string;
    }) => ({
      toString: () => `${scheme}://${authority}${path}`,
    }),
  },
}));

const config = {
  detail: { enable: true },
  focusSuppression: { enable: true },
  editor: { enable: false },
  windows: {
    notification: { enable: true, sound: { enable: false } },
    taskbar: { flash: { enable: true } },
  },
} satisfies NotificationDeliveryConfig;

const notification = createNotificationRequest({
  body: "Review the result.",
  notificationId: "synthetic-notification",
  source: null,
  title: "Agent finished",
  workspace: {
    display: { branch: null, label: null },
    instanceId: "0".repeat(64),
  },
});
const target = {
  authority: "",
  path: "/c:/synthetic-workspace",
  scheme: "file",
} satisfies NotificationDeliveryTarget;

describe("WindowsNotificationAdapter", () => {
  it("allows notifications by default", () => {
    const adapter = new WindowsNotificationAdapter({
      appName: "Visual Studio Code",
      scriptPath: "synthetic-script",
      showNotification: vi.fn(),
      uriScheme: "vscode",
    });

    expect(adapter.allow(config)).toBe(true);
    expect(
      adapter.allow({
        ...config,
        windows: {
          ...config.windows,
          notification: { ...config.windows.notification, enable: false },
        },
      }),
    ).toBe(false);
  });

  it("delivers sound config and workspace activation", async () => {
    const showNotification = vi
      .fn<typeof showWindowsNotification>()
      .mockResolvedValue({ status: "success" });
    const adapter = new WindowsNotificationAdapter({
      appName: "Visual Studio Code",
      scriptPath: "synthetic-script",
      showNotification,
      uriScheme: "vscode",
    });
    const signal = new AbortController().signal;

    await adapter.deliver({ config, notification, signal, target });

    expect(showNotification).toHaveBeenCalledWith({
      activationUri: "vscode://file/c:/synthetic-workspace",
      appName: "Visual Studio Code",
      body: "Review the result.",
      scriptPath: "synthetic-script",
      signal,
      sound: false,
      title: "Agent finished",
    } satisfies Parameters<typeof showWindowsNotification>[0]);

    await adapter.deliver({
      config: {
        ...config,
        windows: {
          ...config.windows,
          notification: {
            ...config.windows.notification,
            sound: { enable: true },
          },
        },
      },
      notification,
      signal,
      target,
    });

    expect(showNotification).toHaveBeenLastCalledWith(
      expect.objectContaining({ sound: true } satisfies Pick<
        Parameters<typeof showWindowsNotification>[0],
        "sound"
      >),
    );
  });

  it("rejects an unsupported workspace before invoking PowerShell", async () => {
    const showNotification = vi.fn();
    const adapter = new WindowsNotificationAdapter({
      appName: "Visual Studio Code",
      scriptPath: "synthetic-script",
      showNotification,
      uriScheme: "vscode",
    });

    await expect(
      adapter.deliver({
        config,
        notification,
        signal: new AbortController().signal,
        target: { authority: "", path: "/workspace", scheme: "untitled" },
      }),
    ).rejects.toThrow(
      "Windows notification delivery requires a local or remote VS Code workspace.",
    );

    expect(showNotification).not.toHaveBeenCalled();
  });
});
