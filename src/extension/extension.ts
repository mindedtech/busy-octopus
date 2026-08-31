/**
 * @file Activate trusted workspace queue consumption in the VS Code UI host.
 *
 * @see https://code.visualstudio.com/api/get-started/extension-anatomy#extension-entry-file
 */

import { platform } from "node:os";
import { type ExtensionContext, Uri, window, workspace } from "vscode";
import { NotificationQueue } from "../queue/queue.js";
import { ExtensionDiagnosticReporter } from "./diagnostic.js";
import { WorkspaceQueueConsumer } from "./queue/consumer.js";
import { WorkspaceQueueFileSystem } from "./queue/file-system.js";
import { locateExtensionWorkspaceQueue } from "./queue/location.js";
import { ExtensionWorkspaceConsumer } from "./workspace-consumer.js";

/**
 * Start queue consumption for trusted workspace folders.
 */
export const activate = (context: ExtensionContext): void => {
  const diagnosticReporter = new ExtensionDiagnosticReporter(
    window.createOutputChannel("Busy Octopus", { log: true }),
  );
  const fileSystem = new WorkspaceQueueFileSystem({
    fileSystem: workspace.fs,
    join: Uri.joinPath,
  });
  const consumer = new ExtensionWorkspaceConsumer({
    createConsumer: ({ uri }) => {
      const directory = locateExtensionWorkspaceQueue({
        createLocalResource: Uri.file,
        localPlatform: platform() === "win32" ? "win32" : "posix",
        workspace: {
          fsPath: uri.fsPath,
          path: uri.path,
          scheme: uri.scheme,
          useRemotePath: (path) => uri.with({ fragment: "", path, query: "" }),
        },
      });

      return new WorkspaceQueueConsumer({
        diagnose: diagnosticReporter.report,
        intervalMilliseconds: 1_000,
        onRequest: async () => undefined,
        queue: new NotificationQueue({ directory, fileSystem }),
        schedule: (callback, intervalMilliseconds) => {
          const timer = setInterval(callback, intervalMilliseconds);

          return { dispose: () => clearInterval(timer) };
        },
      });
    },
    onFolderListChange: (onChange) =>
      workspace.onDidChangeWorkspaceFolders((event) =>
        onChange({
          folderList: {
            addition: [...event.added],
            removal: [...event.removed],
          },
        }),
      ),
    onTrust: workspace.onDidGrantWorkspaceTrust,
    readFolderList: () => [...(workspace.workspaceFolders ?? [])],
    readTrust: () => workspace.isTrusted,
  });

  context.subscriptions.push(consumer, diagnosticReporter);
};
