/**
 * @file Own queue consumers for trusted VS Code workspace folders.
 */

import type { Disposable } from "vscode";

type WorkspaceFolderReference = {
  uri: { toString: () => string };
};

type WorkspaceFolderChange<Folder extends WorkspaceFolderReference> = {
  folderList: {
    addition: Folder[];
    removal: Folder[];
  };
};

/**
 * Start queue consumers only after trust and track workspace-folder changes.
 */
export class ExtensionWorkspaceConsumer<Folder extends WorkspaceFolderReference>
  implements Disposable
{
  #consumerMap = new Map<string, Disposable>();
  #createConsumer: (folder: Folder) => Disposable;
  #folderListener: Disposable | null = null;
  #onFolderListChange: (
    callback: (change: WorkspaceFolderChange<Folder>) => void,
  ) => Disposable;
  #onTrust: (callback: () => void) => Disposable;
  #readFolderList: () => Folder[];
  #readTrust: () => boolean;
  #trustListener: Disposable;

  constructor({
    createConsumer,
    onFolderListChange,
    onTrust,
    readFolderList,
    readTrust,
  }: {
    createConsumer: (folder: Folder) => Disposable;
    onFolderListChange: (
      callback: (change: WorkspaceFolderChange<Folder>) => void,
    ) => Disposable;
    onTrust: (callback: () => void) => Disposable;
    readFolderList: () => Folder[];
    readTrust: () => boolean;
  }) {
    this.#createConsumer = createConsumer;
    this.#onFolderListChange = onFolderListChange;
    this.#onTrust = onTrust;
    this.#readFolderList = readFolderList;
    this.#readTrust = readTrust;

    this.#trustListener = this.#onTrust(this.#start);
    this.#start();
  }

  dispose = (): void => {
    this.#trustListener.dispose();
    this.#folderListener?.dispose();
    this.#folderListener = null;

    for (const consumer of this.#consumerMap.values()) {
      consumer.dispose();
    }

    this.#consumerMap.clear();
  };

  #add = (folder: Folder): void => {
    const key = folder.uri.toString();

    if (!this.#consumerMap.has(key)) {
      this.#consumerMap.set(key, this.#createConsumer(folder));
    }
  };

  #remove = (folder: Folder): void => {
    const key = folder.uri.toString();
    this.#consumerMap.get(key)?.dispose();
    this.#consumerMap.delete(key);
  };

  #start = (): void => {
    if (!this.#readTrust() || this.#folderListener !== null) {
      return;
    }

    for (const folder of this.#readFolderList()) {
      this.#add(folder);
    }

    this.#folderListener = this.#onFolderListChange(
      ({ folderList: { addition, removal } }) => {
        for (const folder of removal) {
          this.#remove(folder);
        }

        for (const folder of addition) {
          this.#add(folder);
        }
      },
    );
  };
}
