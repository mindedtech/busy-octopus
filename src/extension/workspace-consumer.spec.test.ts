/**
 * @file Verify trusted workspace and folder lifecycle ownership.
 */

import { assert, describe, expect, it, type Mock, vi } from "vitest";
import type { Disposable } from "vscode";
import { ExtensionWorkspaceConsumer } from "./workspace-consumer.js";

type Folder = {
  uri: { toString: () => string };
};

type ConsumerInput = ConstructorParameters<
  typeof ExtensionWorkspaceConsumer<Folder>
>[0];

const createFolder = (value: string): Folder => ({
  uri: { toString: () => value },
});

describe("ExtensionWorkspaceConsumer", () => {
  it("waits for workspace trust before starting consumers", () => {
    const folder = createFolder("file:///synthetic-workspace");
    let workspaceTrust = false;
    const createConsumer = vi.fn<ConsumerInput["createConsumer"]>(() => ({
      dispose: vi.fn<Disposable["dispose"]>(),
    }));
    const onTrust = vi.fn<ConsumerInput["onTrust"]>(() => ({
      dispose: vi.fn<Disposable["dispose"]>(),
    }));

    const consumer = new ExtensionWorkspaceConsumer({
      createConsumer,
      onFolderListChange: () => ({ dispose: vi.fn<Disposable["dispose"]>() }),
      onTrust,
      readFolderList: () => [folder],
      readTrust: () => workspaceTrust,
    });

    expect(createConsumer).not.toHaveBeenCalled();
    const { lastCall } = onTrust.mock;
    assert(lastCall !== undefined, "Trust callback must be registered.");
    const [grantTrust] = lastCall;
    workspaceTrust = true;
    grantTrust();
    expect(createConsumer).toHaveBeenCalledWith(folder);
    consumer.dispose();
  });

  it("tracks folder additions and removals", () => {
    const firstFolder = createFolder("file:///first");
    const secondFolder = createFolder("file:///second");
    const disposeMap = new Map<string, Mock<Disposable["dispose"]>>();
    const onFolderListChange = vi.fn<ConsumerInput["onFolderListChange"]>(
      () => ({ dispose: vi.fn<Disposable["dispose"]>() }),
    );
    const consumer = new ExtensionWorkspaceConsumer({
      createConsumer: (folder) => {
        const dispose = vi.fn<Disposable["dispose"]>();
        disposeMap.set(folder.uri.toString(), dispose);
        return { dispose };
      },
      onFolderListChange,
      onTrust: () => ({ dispose: vi.fn<Disposable["dispose"]>() }),
      readFolderList: () => [firstFolder],
      readTrust: () => true,
    });

    const { lastCall } = onFolderListChange.mock;
    assert(
      lastCall !== undefined,
      "Folder change callback must be registered.",
    );
    const [changeFolderList] = lastCall;
    changeFolderList({
      folderList: { addition: [secondFolder], removal: [firstFolder] },
    });

    expect(disposeMap.get(firstFolder.uri.toString())).toHaveBeenCalledOnce();
    expect(disposeMap.get(secondFolder.uri.toString())).not.toHaveBeenCalled();
    consumer.dispose();
    expect(disposeMap.get(secondFolder.uri.toString())).toHaveBeenCalledOnce();
  });
});
