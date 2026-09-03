/**
 * @file Verify bounded, content-free extension diagnostic reports.
 */

import { describe, expect, it, vi } from "vitest";
import { ExtensionDiagnosticReporter } from "./diagnostic.js";

describe("ExtensionDiagnosticReporter", () => {
  it("reports each fixed code once", () => {
    const output = { dispose: vi.fn(), warn: vi.fn() };
    const showErrorMessage = vi.fn();
    const diagnosticReporter = new ExtensionDiagnosticReporter(output, {
      showErrorMessage,
    });

    diagnosticReporter.report("queue-access-error");
    diagnosticReporter.report("queue-access-error");
    diagnosticReporter.report("request-consumer-error");
    diagnosticReporter.report("taskbar-process-error");
    diagnosticReporter.report("taskbar-process-error");

    expect(output.warn.mock.calls).toEqual([
      ["queue-access-error"],
      ["request-consumer-error"],
      ["taskbar-process-error"],
    ]);
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  it("shows configuration errors once", () => {
    const output = { dispose: vi.fn(), warn: vi.fn() };
    const showErrorMessage = vi.fn();
    const diagnosticReporter = new ExtensionDiagnosticReporter(output, {
      showErrorMessage,
    });

    diagnosticReporter.report("delivery-configuration-error");
    diagnosticReporter.report("delivery-configuration-error");

    expect(showErrorMessage).toHaveBeenCalledOnce();
    expect(showErrorMessage).toHaveBeenCalledWith(
      "Busy Octopus could not read its notification settings.",
    );
  });

  it("disposes its output", () => {
    const output = { dispose: vi.fn(), warn: vi.fn() };

    new ExtensionDiagnosticReporter(output, {
      showErrorMessage: vi.fn(),
    }).dispose();

    expect(output.dispose).toHaveBeenCalledOnce();
  });
});
