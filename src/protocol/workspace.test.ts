/**
 * @file Verify strict workspace association behavior.
 */

import { describe, expect, it } from "vitest";
import { WorkspaceContext, WorkspaceDisplay } from "./workspace.js";

describe("WorkspaceDisplay", () => {
  it("validates the standalone strict display contract", () => {
    expect(
      WorkspaceDisplay.safeParse({
        label: "Fixture workspace",
        branch: "feature/fixture",
      }).success,
    ).toBe(true);
    expect(WorkspaceDisplay.safeParse(null).success).toBe(false);
  });
});

describe("WorkspaceContext", () => {
  it("accepts full display context", () => {
    expect(
      WorkspaceContext.parse({
        instanceId: "workspace-fixture",
        display: {
          label: "Fixture workspace",
          branch: "feature/fixture",
        },
      }),
    ).toEqual({
      instanceId: "workspace-fixture",
      display: {
        label: "Fixture workspace",
        branch: "feature/fixture",
      },
    });
  });

  it("accepts explicit null display values", () => {
    expect(
      WorkspaceContext.safeParse({
        instanceId: "workspace-fixture",
        display: { label: null, branch: null },
      }).success,
    ).toBe(true);
  });
  it.each([
    [
      "instance identifier",
      { instanceId: 42, display: { label: null, branch: null } },
    ],
    ["display context", { instanceId: "workspace-fixture", display: null }],
    [
      "display label",
      {
        instanceId: "workspace-fixture",
        display: { label: 42, branch: null },
      },
    ],
    [
      "branch label",
      {
        instanceId: "workspace-fixture",
        display: { label: null, branch: false },
      },
    ],
  ])("rejects a wrong %s type", (_domain, workspace) => {
    expect(WorkspaceContext.safeParse(workspace).success).toBe(false);
  });

  it.each([
    ["instance identifier", { display: { label: null, branch: null } }],
    ["display context", { instanceId: "workspace-fixture" }],
    [
      "display label",
      {
        instanceId: "workspace-fixture",
        display: { branch: null },
      },
    ],
    [
      "branch label",
      {
        instanceId: "workspace-fixture",
        display: { label: null },
      },
    ],
  ])("rejects a missing %s", (_domain, workspace) => {
    expect(WorkspaceContext.safeParse(workspace).success).toBe(false);
  });

  it.each([
    [
      "instance identifier",
      { instanceId: " ", display: { label: null, branch: null } },
    ],
    [
      "display label",
      {
        instanceId: "workspace-fixture",
        display: { label: "\t", branch: null },
      },
    ],
    [
      "branch label",
      {
        instanceId: "workspace-fixture",
        display: { label: null, branch: "\n" },
      },
    ],
  ])("rejects a blank %s", (_domain, workspace) => {
    expect(WorkspaceContext.safeParse(workspace).success).toBe(false);
  });

  it.each([
    ["instance identifier", "a".repeat(128), "a".repeat(129), "instanceId"],
    ["display label", "a".repeat(120), "a".repeat(121), "label"],
    ["branch label", "a".repeat(256), "a".repeat(257), "branch"],
  ])("enforces the %s boundary", (_domain, exact, overflow, field) => {
    const baseWorkspace = {
      instanceId: "workspace-fixture",
      display: { label: "Fixture workspace", branch: "feature/fixture" },
    };
    const workspace = {
      valid:
        field === "instanceId"
          ? { ...baseWorkspace, instanceId: exact }
          : {
              ...baseWorkspace,
              display: { ...baseWorkspace.display, [field]: exact },
            },
      invalid:
        field === "instanceId"
          ? { ...baseWorkspace, instanceId: overflow }
          : {
              ...baseWorkspace,
              display: { ...baseWorkspace.display, [field]: overflow },
            },
    };

    expect(WorkspaceContext.safeParse(workspace.valid).success).toBe(true);
    expect(WorkspaceContext.safeParse(workspace.invalid).success).toBe(false);
  });

  it("requires every display field", () => {
    expect(
      WorkspaceContext.safeParse({
        instanceId: "workspace-fixture",
        display: { label: null },
      }).success,
    ).toBe(false);
  });

  it("rejects unknown workspace fields", () => {
    expect(
      WorkspaceContext.safeParse({
        instanceId: "workspace-fixture",
        display: { label: null, branch: null },
        routingHint: "synthetic",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown display fields", () => {
    expect(
      WorkspaceContext.safeParse({
        instanceId: "workspace-fixture",
        display: { label: null, branch: null, repository: "fixture" },
      }).success,
    ).toBe(false);
  });
});
