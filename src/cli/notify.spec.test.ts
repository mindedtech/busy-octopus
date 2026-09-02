/**
 * @file Verify the notification command.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { notify } from "../library/notify.js";
import { runTestCli } from "./test.js";

const { publish } = vi.hoisted(() => ({
  publish: vi.fn<typeof notify>(),
}));

vi.mock("../library/notify.js", () => ({ notify: publish }));

beforeEach(() => {
  publish.mockReset();
});

describe("notify", () => {
  it("shows help", async () => {
    const result = await runTestCli(["notify", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Usage: busy-octopus notify [options]");
    expect(result.stdout).toContain("--title <text>");
    expect(result.stdout).toContain("--source-kind <kind>");
    expect(result.stdout).toContain("--source-name <name>");
  });

  it("maps notification options to the library", async () => {
    publish.mockResolvedValue({ notificationId: "synthetic-notification" });

    await expect(
      runTestCli([
        "notify",
        "--title",
        "Synthetic task finished",
        "--body",
        "Review the synthetic result.",
        "--directory",
        "/synthetic/workspace",
        "--notification-id",
        "synthetic-notification",
        "--source-kind",
        "test",
        "--source-name",
        "Synthetic runner",
      ]),
    ).resolves.toEqual({
      exitCode: 0,
      stderr: "",
      stdout: "synthetic-notification\n",
    });
    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith({
      body: "Review the synthetic result.",
      directory: "/synthetic/workspace",
      notificationId: "synthetic-notification",
      source: { kind: "test", name: "Synthetic runner" },
      title: "Synthetic task finished",
    });
  });

  it("uses explicit nulls and lets the library infer optional values", async () => {
    publish.mockResolvedValue({ notificationId: "synthetic-notification" });

    await runTestCli(["notify", "--title", "Synthetic task finished"]);

    expect(publish).toHaveBeenCalledWith({
      body: null,
      source: null,
      title: "Synthetic task finished",
    });
  });

  it.each([
    ["notify"],
    ["notify", "--unknown"],
    ["notify", "--title", "Synthetic task finished", "unexpected"],
    ["notify", "--title", "Synthetic task finished", "--source-kind", "test"],
    [
      "notify",
      "--title",
      "Synthetic task finished",
      "--source-name",
      "Synthetic runner",
    ],
  ])(
    "rejects invalid arguments without publishing: %j",
    async (...argumentList) => {
      const result = await runTestCli(argumentList);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).not.toBe("");
      expect(result.stdout).toBe("");
      expect(publish).not.toHaveBeenCalled();
    },
  );

  it("reports publication failure without notification content", async () => {
    publish.mockRejectedValue(new Error("Synthetic task finished"));

    await expect(
      runTestCli(["notify", "--title", "Synthetic task finished"]),
    ).resolves.toEqual({
      exitCode: 1,
      stderr: "busy-octopus: unable to publish the notification.\n",
      stdout: "",
    });
  });
});
