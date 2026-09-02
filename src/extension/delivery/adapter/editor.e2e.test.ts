/**
 * @file Verify editor notification delivery in a real VS Code extension host.
 */

import { assert, expect } from "chai";
import { stub } from "sinon";
import {
  ConfigurationTarget,
  commands,
  extensions,
  window,
  workspace,
} from "vscode";

suite("Editor notification delivery", () => {
  test("follows config for test notifications", async () => {
    const extension = extensions.getExtension("mindedtech.busy-octopus");
    assert.exists(extension, "Busy Octopus extension is missing.");

    await extension.activate();

    expect(extension.isActive, "Busy Octopus extension is inactive.").to.equal(
      true,
    );

    const config = workspace.getConfiguration("busyOctopus");
    await config.update("editor.enable", false, ConfigurationTarget.Workspace);
    await config.update(
      "disableFocusSuppression",
      true,
      ConfigurationTarget.Workspace,
    );
    const showInformationMessage = stub(
      window,
      "showInformationMessage",
    ).resolves(undefined);

    try {
      await commands.executeCommand("busyOctopus.showTestNotification");

      expect(showInformationMessage.callCount).to.equal(0);

      await config.update("editor.enable", true, ConfigurationTarget.Workspace);
      await commands.executeCommand("busyOctopus.showTestNotification");

      expect(showInformationMessage.callCount).to.equal(1);
      expect(showInformationMessage.firstCall.firstArg).to.equal(
        "Busy Octopus — Notification delivery is working.",
      );
    } finally {
      showInformationMessage.restore();
      await config.update(
        "editor.enable",
        undefined,
        ConfigurationTarget.Workspace,
      );
      await config.update(
        "disableFocusSuppression",
        undefined,
        ConfigurationTarget.Workspace,
      );
    }
  });
});
