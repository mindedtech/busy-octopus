/**
 * @file Verify exact Windows taskbar attention ownership.
 */

import { assert, describe, expect, it, vi } from "vitest";
import type { Disposable } from "vscode";
import { EditorWindowHandle } from "../../../windows/bridge.js";
import type { NotificationDeliveryConfig } from "../../config.js";
import { WindowsTaskbarAdapter } from "./taskbar.js";

type TaskbarAdapterInput = ConstructorParameters<
  typeof WindowsTaskbarAdapter
>[0];
type TaskbarBridge = TaskbarAdapterInput["bridge"];

const windowHandle = EditorWindowHandle.parse("987654");

const config = {
  detail: { enable: true },
  focusSuppression: { enable: true },
  editor: { enable: false },
  windows: {
    notification: { enable: true, sound: { enable: false } },
    taskbar: { flash: { enable: true } },
  },
} satisfies NotificationDeliveryConfig;

const createAdapter = ({ focus = true }: { focus?: boolean } = {}) => {
  let currentFocus = focus;
  const bridge = {
    captureWindow: vi.fn<TaskbarBridge["captureWindow"]>().mockResolvedValue({
      status: "success",
      windowHandle,
    }),
    startFlash: vi
      .fn<TaskbarBridge["startFlash"]>()
      .mockResolvedValue({ status: "success" }),
    stopFlash: vi
      .fn<TaskbarBridge["stopFlash"]>()
      .mockResolvedValue({ status: "success" }),
  } satisfies TaskbarBridge;
  const dispose = vi.fn<Disposable["dispose"]>();
  const onFocusChange = vi.fn<TaskbarAdapterInput["onFocusChange"]>(() => ({
    dispose,
  }));
  const adapter = new WindowsTaskbarAdapter({
    bridge,
    diagnose: vi.fn<TaskbarAdapterInput["diagnose"]>(),
    onFocusChange,
    readFocus: () => currentFocus,
  });
  const [registration] = onFocusChange.mock.calls;
  assert(
    registration !== undefined,
    "Taskbar adapter must register a focus listener.",
  );
  const [changeFocus] = registration;

  return {
    adapter,
    bridge,
    dispose,
    setFocus: (value: boolean) => {
      currentFocus = value;
      changeFocus(value);
    },
  };
};

describe("WindowsTaskbarAdapter", () => {
  it("allows taskbar flashing by default", () => {
    const { adapter } = createAdapter({ focus: false });

    expect(adapter.allow(config)).toBe(true);
    expect(
      adapter.allow({
        ...config,
        windows: {
          ...config.windows,
          taskbar: { flash: { enable: false } },
        },
      }),
    ).toBe(false);

    adapter.dispose();
  });

  it("flashes the captured window only while unfocused", async () => {
    const { adapter, bridge, setFocus } = createAdapter();
    await vi.waitFor(() => expect(bridge.captureWindow).toHaveBeenCalledOnce());
    setFocus(false);
    const signal = new AbortController().signal;

    await adapter.deliver({
      config,
      notification: {
        body: null,
        creationTime: "2026-08-28T12:34:56.789Z",
        notificationId: "synthetic-notification",
        schemaVersion: 1,
        source: null,
        title: "Synthetic notification",
        workspace: {
          display: { branch: null, label: null },
          instanceId: "0".repeat(64),
        },
      },
      signal,
      target: { authority: "", path: "/workspace", scheme: "file" },
    });

    expect(bridge.startFlash).toHaveBeenCalledWith({
      signal,
      windowHandle,
    } satisfies Parameters<TaskbarBridge["startFlash"]>[0]);
    setFocus(true);
    await vi.waitFor(() => expect(bridge.stopFlash).toHaveBeenCalled());
    adapter.dispose();
  });

  it("releases its listener and stops flashing on disposal", async () => {
    const { adapter, bridge, dispose } = createAdapter();
    await vi.waitFor(() => expect(bridge.captureWindow).toHaveBeenCalledOnce());

    adapter.dispose();

    expect(dispose).toHaveBeenCalledOnce();
    await vi.waitFor(() =>
      expect(bridge.stopFlash).toHaveBeenCalledWith({
        windowHandle,
      } satisfies Parameters<TaskbarBridge["stopFlash"]>[0]),
    );
  });
});
