/**
 * @file Verify the notification routing diagnostic command.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { resolveWorkspaceQueue } from "../workspace/queue.js";
import { runTestCli } from "./test.js";

const { resolveQueue } = vi.hoisted(() => ({
  resolveQueue: vi.fn<typeof resolveWorkspaceQueue>(),
}));

vi.mock("../workspace/queue.js", () => ({
  resolveWorkspaceQueue: resolveQueue,
}));

beforeEach(() => {
  resolveQueue.mockReset();
  resolveQueue.mockResolvedValue({
    context: {
      display: { branch: null, label: "synthetic-workspace" },
      instanceId: "0".repeat(64),
    },
    path: "/synthetic/workspace",
    platform: "posix",
    queueDirectory: "/synthetic/queue",
  });
});

describe("doctor", () => {
  it("shows help", async () => {
    const result = await runTestCli(["doctor", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Usage: busy-octopus doctor [options]");
    expect(result.stdout).toContain("--directory <path>");
  });

  it("checks explicit workspace routing without exposing its context", async () => {
    await expect(
      runTestCli(["doctor", "--directory", "/private/synthetic-workspace"]),
    ).resolves.toEqual({
      exitCode: 0,
      stderr: "",
      stdout: "Workspace resolution: ok\nQueue routing: ok\n",
    });
    expect(resolveQueue).toHaveBeenCalledOnce();
    expect(resolveQueue).toHaveBeenCalledWith({
      directory: "/private/synthetic-workspace",
    });
  });

  it("checks routing for the inferred workspace", async () => {
    await runTestCli(["doctor"]);

    expect(resolveQueue).toHaveBeenCalledWith({});
  });

  it("reports routing failure without workspace context", async () => {
    resolveQueue.mockRejectedValue(
      new Error("/private/synthetic-workspace feature/secret"),
    );

    await expect(
      runTestCli(["doctor", "--directory", "/private/synthetic-workspace"]),
    ).resolves.toEqual({
      exitCode: 1,
      stderr: "busy-octopus: unable to resolve notification routing.\n",
      stdout: "",
    });
  });
});
