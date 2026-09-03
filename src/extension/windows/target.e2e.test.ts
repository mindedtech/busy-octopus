/**
 * @file Verify workspace activation URIs through the real VS Code URI API.
 */

import { expect } from "chai";
import { createWorkspaceActivationUri } from "./target.js";

suite("Windows workspace activation", () => {
  test("routes local and remote workspaces through the editor protocol", () => {
    expect(
      createWorkspaceActivationUri({
        target: {
          authority: "",
          path: "/c:/synthetic workspace",
          scheme: "file",
        },
        uriScheme: "vscode",
      }),
    ).to.equal("vscode://file/c%3A/synthetic%20workspace");

    expect(
      createWorkspaceActivationUri({
        target: {
          authority: "dev-container+synthetic",
          path: "/workspace",
          scheme: "vscode-remote",
        },
        uriScheme: "vscode-insiders",
      }),
    ).to.equal(
      "vscode-insiders://vscode-remote/dev-container%2Bsynthetic/workspace",
    );
  });

  test("rejects unsupported workspace schemes", () => {
    expect(
      createWorkspaceActivationUri({
        target: { authority: "", path: "/workspace", scheme: "untitled" },
        uriScheme: "vscode",
      }),
    ).to.equal(null);
  });
});
