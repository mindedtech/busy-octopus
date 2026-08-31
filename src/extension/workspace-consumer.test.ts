/**
 * @file Verify trusted workspace and folder lifecycle ownership.
 */

import { describe, expect, it, vi } from "vitest";
import { ExtensionWorkspaceConsumer } from "./workspace-consumer.js";

type Folder = {
  uri: { toString: () => string };
};

const createFolder = (value: string): Folder => ({
  uri: { toString: () => value },
});

describe("ExtensionWorkspaceConsumer", () => {
  it("waits for workspace trust before starting consumers", () => {
    const folder = createFolder("file:///synthetic-workspace");
    let workspaceTrust = false;
    let grantTrust = (): void => undefined;
    const createConsumer = vi.fn(() => ({ dispose: vi.fn() }));

    const consumer = new ExtensionWorkspaceConsumer({
      createConsumer,
      onFolderListChange: () => ({ dispose: vi.fn() }),
      onTrust: (callback) => {
        grantTrust = callback;
        return { dispose: vi.fn() };
      },
      readFolderList: () => [folder],
      readTrust: () => workspaceTrust,
    });

    expect(createConsumer).not.toHaveBeenCalled();
    workspaceTrust = true;
    grantTrust();
    expect(createConsumer).toHaveBeenCalledWith(folder);
    consumer.dispose();
  });

  it("tracks folder additions and removals", () => {
    const firstFolder = createFolder("file:///first");
    const secondFolder = createFolder("file:///second");
    let changeFolderList = (): void => undefined;
    const disposeMap = new Map<string, ReturnType<typeof vi.fn>>();
    const consumer = new ExtensionWorkspaceConsumer({
      createConsumer: (folder) => {
        const dispose = vi.fn();
        disposeMap.set(folder.uri.toString(), dispose);
        return { dispose };
      },
      onFolderListChange: (onChange) => {
        changeFolderList = () =>
          onChange({
            folderList: { addition: [secondFolder], removal: [firstFolder] },
          });
        return { dispose: vi.fn() };
      },
      onTrust: () => ({ dispose: vi.fn() }),
      readFolderList: () => [firstFolder],
      readTrust: () => true,
    });

    changeFolderList();

    expect(disposeMap.get(firstFolder.uri.toString())).toHaveBeenCalledOnce();
    expect(disposeMap.get(secondFolder.uri.toString())).not.toHaveBeenCalled();
    consumer.dispose();
    expect(disposeMap.get(secondFolder.uri.toString())).toHaveBeenCalledOnce();
  });
});
