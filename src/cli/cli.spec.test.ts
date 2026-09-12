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
    expect(result.stdout).toContain("run [options] <command> [argument...]");
  });

  it.each(["-v", "--version"])(
    "shows the package version: %s",
    async (flag) => {
      const result = await runTestCli([flag]);

      expect(result).toEqual({
        exitCode: 0,
        stderr: "",
        stdout: expect.stringMatching(/^\d+\.\d+\.\d+\n$/u),
      });
    },
  );

  it("rejects an unknown command", async () => {
    const result = await runTestCli(["unknown"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).not.toBe("");
    expect(result.stdout).toBe("");
  });
});
