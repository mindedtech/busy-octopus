/**
 * @file Exact workspace window taskbar attention lifecycle.
 */

import type { Disposable } from "vscode";
import type { DiagnosticCode } from "../../../diagnostic.js";
import type {
  EditorWindowHandle,
  NativeOperation,
  WindowCapture,
} from "../../../windows/bridge.js";
import type { NotificationDeliveryAdapter } from "../../adapter.js";

type TaskbarBridge = {
  /**
   * Capture the focused window after validating editor ownership.
   */
  captureWindow: () => Promise<WindowCapture>;

  /**
   * Start attention for one exact validated window handle.
   */
  startFlash: (input: {
    signal: AbortSignal;
    windowHandle: EditorWindowHandle;
  }) => Promise<NativeOperation>;

  /**
   * Stop attention for one exact validated window handle.
   */
  stopFlash: (input: {
    windowHandle: EditorWindowHandle;
  }) => Promise<NativeOperation>;
};

/**
 * Taskbar adapter bound to the exact focused editor window.
 */
export class WindowsTaskbarAdapter
  implements NotificationDeliveryAdapter, Disposable
{
  #bridge: TaskbarBridge;
  #captureGeneration = 0;
  #diagnose: (code: DiagnosticCode) => void;
  #active = true;
  #focusListener: Disposable;
  #readFocus: () => boolean;
  #windowHandle: EditorWindowHandle | null = null;

  constructor({
    bridge,
    diagnose,
    onFocusChange,
    readFocus,
  }: {
    bridge: TaskbarBridge;
    diagnose: (code: DiagnosticCode) => void;
    onFocusChange: (callback: (focus: boolean) => void) => Disposable;
    readFocus: () => boolean;
  }) {
    this.#bridge = bridge;
    this.#diagnose = diagnose;
    this.#readFocus = readFocus;
    this.#focusListener = onFocusChange((focus) => {
      if (focus) {
        void this.#capture();
      }
    });

    if (readFocus()) {
      void this.#capture();
    }
  }

  /**
   * Check whether Windows taskbar flashing is enabled.
   */
  allow: NotificationDeliveryAdapter["allow"] = ({ windows }) =>
    windows.taskbar.flash.enable;

  /**
   * Flash the source workspace window while it remains unfocused.
   */
  deliver: NotificationDeliveryAdapter["deliver"] = async ({ signal }) => {
    if (signal.aborted || this.#readFocus() || this.#windowHandle === null) {
      return;
    }

    await this.#bridge.startFlash({
      signal,
      windowHandle: this.#windowHandle,
    });
  };

  /**
   * Stop taskbar attention and release the focus listener.
   */
  dispose = (): void => {
    this.#active = false;
    this.#captureGeneration += 1;
    this.#focusListener.dispose();

    if (this.#windowHandle !== null) {
      void this.#stop(this.#windowHandle);
    }
  };

  #capture = async (): Promise<void> => {
    const generation = ++this.#captureGeneration;
    const previousHandle = this.#windowHandle;

    try {
      if (previousHandle !== null) {
        await this.#bridge.stopFlash({ windowHandle: previousHandle });
      }

      const capture = await this.#bridge.captureWindow();
      if (
        !this.#active ||
        generation !== this.#captureGeneration ||
        !this.#readFocus()
      ) {
        return;
      }

      if (capture.status === "success") {
        this.#windowHandle = capture.windowHandle;
      }
    } catch {
      this.#diagnose("delivery-adapter-error");
    }
  };

  #stop = async (windowHandle: EditorWindowHandle): Promise<void> => {
    try {
      await this.#bridge.stopFlash({ windowHandle });
    } catch {
      this.#diagnose("delivery-adapter-error");
    }
  };
}
