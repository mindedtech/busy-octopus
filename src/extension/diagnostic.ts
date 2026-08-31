/**
 * @file Report bounded extension failures without notification content.
 */

import type { LogOutputChannel } from "vscode";

export type DiagnosticCode =
  | "claim-release-error"
  | "queue-access-error"
  | "request-consumer-error";

export type DiagnosticOutput = Pick<LogOutputChannel, "dispose" | "warn">;

/**
 * Report each known failure at most once per extension session.
 */
export class ExtensionDiagnosticReporter {
  #codeSet = new Set<DiagnosticCode>();
  #output: DiagnosticOutput;

  constructor(output: DiagnosticOutput) {
    this.#output = output;
  }

  dispose = (): void => {
    this.#codeSet.clear();
    this.#output.dispose();
  };

  report = (code: DiagnosticCode): void => {
    if (this.#codeSet.has(code)) {
      return;
    }

    this.#codeSet.add(code);
    this.#output.warn(code);
  };
}
