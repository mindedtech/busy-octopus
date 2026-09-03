/**
 * @file Bounded extension failure reports without notification content.
 */

import type { Disposable, LogOutputChannel, window } from "vscode";

/**
 * Content-free extension failure category.
 */
export type DiagnosticCode =
  | "claim-release-error"
  | "delivery-adapter-error"
  | "delivery-configuration-error"
  | "queue-access-error"
  | "request-consumer-error"
  | "taskbar-process-error";

/**
 * Output-channel operations required by extension diagnostics.
 */
export type DiagnosticOutput = Pick<LogOutputChannel, "dispose" | "warn">;

/**
 * One report per known failure and extension session.
 */
export class ExtensionDiagnosticReporter implements Disposable {
  #codeSet = new Set<DiagnosticCode>();
  #output: DiagnosticOutput;
  #window: Pick<typeof window, "showErrorMessage">;

  constructor(
    output: DiagnosticOutput,
    editorWindow: Pick<typeof window, "showErrorMessage">,
  ) {
    this.#output = output;
    this.#window = editorWindow;
  }

  /**
   * Dispose the output channel and clear session diagnostic state.
   */
  dispose = (): void => {
    this.#codeSet.clear();
    this.#output.dispose();
  };

  /**
   * Report a known failure once per extension session.
   */
  report = (code: DiagnosticCode): void => {
    if (this.#codeSet.has(code)) {
      return;
    }

    this.#codeSet.add(code);
    this.#output.warn(code);

    switch (code) {
      case "delivery-configuration-error":
        void this.#window.showErrorMessage(
          "Busy Octopus could not read its notification settings.",
        );
        return;
      case "claim-release-error":
      case "delivery-adapter-error":
      case "queue-access-error":
      case "request-consumer-error":
      case "taskbar-process-error":
        return;
    }
  };
}
