/**
 * @file Verify agent setup command options.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { runTestCli } from "../test.js";

const agentSkillText = "# Busy Octopus\n";

const { loadSkill, setup } = vi.hoisted(() => ({
  loadSkill: vi.fn(),
  setup: vi.fn(),
}));

vi.mock("./content.js", () => ({ loadAgentSkillText: loadSkill }));
vi.mock("../../integration/agent/setup.js", () => ({ setupAgent: setup }));

beforeEach(() => {
  loadSkill.mockReset();
  loadSkill.mockResolvedValue(agentSkillText);
  setup.mockReset();
  setup.mockResolvedValue("configured");
});

describe("agent setup", () => {
  it("shows the skill option", async () => {
    const result = await runTestCli(["agent", "setup", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--skill");
  });

  it.each([
    { argumentList: [], skillText: null },
    { argumentList: ["--skill"], skillText: agentSkillText },
  ])("maps skill setup: $argumentList", async ({ argumentList, skillText }) => {
    await expect(
      runTestCli(["agent", "setup", "codex", "--yes", ...argumentList]),
    ).resolves.toEqual({
      exitCode: 0,
      stderr: "",
      stdout: "configured\n",
    });
    expect(setup).toHaveBeenCalledWith({
      confirm: expect.any(Function),
      enableAttention: false,
      provider: "codex",
      skillText,
    });
  });
});
