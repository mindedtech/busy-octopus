/**
 * @file Verify Busy Octopus agent skill output and installation.
 */

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runTestCli } from "../test.js";

const agentSkillText = "# Busy Octopus\n";
const { loadSkill } = vi.hoisted(() => ({ loadSkill: vi.fn() }));

vi.mock("./content.js", () => ({ loadAgentSkillText: loadSkill }));

let fixtureDirectory: string;

beforeEach(async () => {
  loadSkill.mockReset();
  loadSkill.mockResolvedValue(agentSkillText);
  fixtureDirectory = await mkdtemp(join(tmpdir(), "busy-octopus-skill-"));
});

afterEach(async () => {
  await rm(fixtureDirectory, { force: true, recursive: true });
});

describe("agent skill", () => {
  it("shows help", async () => {
    const result = await runTestCli(["agent", "skill", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(
      "Usage: busy-octopus agent skill [options]",
    );
    expect(result.stdout).toContain("--agents");
    expect(result.stdout).toContain("--claude");
  });

  it("writes the skill to standard output by default", async () => {
    const stdoutWrite = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    try {
      const result = await runTestCli(["agent", "skill"]);

      expect(result).toEqual({ exitCode: 0, stderr: "", stdout: "" });
      expect(stdoutWrite).toHaveBeenCalledExactlyOnceWith(agentSkillText);
    } finally {
      stdoutWrite.mockRestore();
    }
  });

  it("installs both project skill layouts", async () => {
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(fixtureDirectory);

    try {
      await expect(
        runTestCli(["agent", "skill", "--agents", "--claude"]),
      ).resolves.toEqual({ exitCode: 0, stderr: "", stdout: "" });
    } finally {
      cwd.mockRestore();
    }

    await expect(
      readFile(
        join(fixtureDirectory, ".agents", "skills", "busy-octopus", "SKILL.md"),
        "utf8",
      ),
    ).resolves.toBe(agentSkillText);
    await expect(
      readFile(
        join(fixtureDirectory, ".claude", "skills", "busy-octopus", "SKILL.md"),
        "utf8",
      ),
    ).resolves.toBe(agentSkillText);
  });
});
