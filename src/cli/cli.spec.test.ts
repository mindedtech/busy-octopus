/**
 * @file Verify the root command-line interface.
 */

import { describe, expect, it } from "vitest";
import { runTestCli } from "./test.js";

describe("program", () => {
  it.each([[], ["--help"]])("shows root help: %j", async (...argumentList) => {
    const result = await runTestCli(argumentList);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Usage: busy-octopus [options] [command]");
    expect(result.stdout).toContain("agent");
    expect(result.stdout).toContain("notify [options]");
    expect(result.stdout).toContain("doctor [options]");
  });

  it("rejects an unknown command", async () => {
    const result = await runTestCli(["unknown"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).not.toBe("");
    expect(result.stdout).toBe("");
  });
});
