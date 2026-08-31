/**
 * @file Activate trusted workspace queue consumption in the VS Code UI host.
 *
 * @see https://code.visualstudio.com/api/get-started/extension-anatomy#extension-entry-file
 */

import { type ExtensionContext, Uri, window, workspace } from "vscode";
import { NotificationQueue } from "../queue/queue.js";
import { resolveWorkspaceQueue } from "../workspace/queue.js";
import { ExtensionDiagnosticReporter } from "./diagnostic.js";
import { WorkspaceQueueConsumer } from "./queue/consumer.js";
import { WorkspaceQueueFileSystem } from "./queue/file-system.js";
import { locateRemoteWorkspaceQueue } from "./queue/location.js";
import { ExtensionWorkspaceConsumer } from "./workspace-consumer.js";

const createWorkspaceQueue = ({
  fileSystem,
  uri,
}: {
  fileSystem: WorkspaceQueueFileSystem<Uri>;
  uri: Uri;
}): Pick<NotificationQueue<Uri>, "claim"> => {
  if (uri.scheme !== "file") {
    return new NotificationQueue({
      directory: locateRemoteWorkspaceQueue({
        workspace: {
          path: uri.path,
          useRemotePath: (path) => uri.with({ fragment: "", path, query: "" }),
        },
      }),
      fileSystem,
    });
  }

  let queue: NotificationQueue<Uri> | null = null;

  return {
    claim: async () => {
      queue ??= new NotificationQueue({
        directory: Uri.file(
          (
            await resolveWorkspaceQueue({
              directory: uri.fsPath,
            })
          ).queueDirectory,
        ),
        fileSystem,
      });

      return queue.claim();
    },
  };
};

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
    createConsumer: ({ uri }) =>
      new WorkspaceQueueConsumer({
        diagnose: diagnosticReporter.report,
        intervalMilliseconds: 1_000,
        onRequest: async () => undefined,
        queue: createWorkspaceQueue({ fileSystem, uri }),
        schedule: (callback, intervalMilliseconds) => {
          const timer = setInterval(callback, intervalMilliseconds);

          return { dispose: () => clearInterval(timer) };
        },
      }),
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
