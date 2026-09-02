/**
 * @file Verify queue consumption in a real VS Code extension host.
 */

import { setTimeout } from "node:timers/promises";
import { assert, expect } from "chai";
import { extensions, Uri, workspace } from "vscode";
import { notify } from "../library/notify.js";
import { resolveWorkspaceQueue } from "../workspace/queue.js";

const awaitQueueConsumption = async (queueUri: Uri): Promise<void> => {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    if ((await workspace.fs.readDirectory(queueUri)).length === 0) {
      return;
    }

    await setTimeout(100);
  }

  expect(
    await workspace.fs.readDirectory(queueUri),
    "VS Code extension left files in the notification queue.",
  ).to.have.length(0);
};

suite("VS Code extension", () => {
  test("activates notification delivery and consumes a request", async () => {
    const folder = workspace.workspaceFolders?.[0];
    assert.exists(folder, "VS Code test workspace is missing.");

    expect(
      workspace.isTrusted,
      "VS Code test workspace is not trusted.",
    ).to.equal(true);

    const extension = extensions.getExtension("mindedtech.busy-octopus");
    assert.exists(extension, "Busy Octopus extension is missing.");

    await extension.activate();

    expect(extension.isActive, "Busy Octopus extension is inactive.").to.equal(
      true,
    );

    const { queueDirectory } = await resolveWorkspaceQueue({
      directory: folder.uri.fsPath,
    });
    const queueUri = Uri.file(queueDirectory);

    await workspace.fs.createDirectory(queueUri);

    try {
      await notify({
        body: null,
        directory: folder.uri.fsPath,
        notificationId: "synthetic-extension-host-notification",
        source: null,
        title: "Synthetic extension host notification",
      });
      await awaitQueueConsumption(queueUri);
    } finally {
      await workspace.fs.delete(queueUri, {
        recursive: true,
        useTrash: false,
      });
    }
  });
});
