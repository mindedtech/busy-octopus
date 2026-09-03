/**
 * @file Trusted workspace queue consumption in the VS Code UI host.
 *
 * @see https://code.visualstudio.com/api/get-started/extension-anatomy#extension-entry-file
 */

import {
  commands,
  type ExtensionContext,
  Uri,
  type WorkspaceFolder,
  window,
  workspace,
} from "vscode";
import { createNotificationRequest } from "../protocol/notification.js";
import { WorkspaceContext, WorkspaceLabel } from "../protocol/workspace.js";
import { NotificationQueue } from "../queue/queue.js";
import { identifyWorkspace } from "../workspace/identity.js";
import { resolveWorkspaceQueue } from "../workspace/queue.js";
import { EditorNotificationAdapter } from "./delivery/adapter/editor.js";
import { NotificationDeliveryConfig } from "./delivery/config.js";
import { NotificationDeliveryDispatcher } from "./delivery/dispatcher.js";
import { ExtensionDiagnosticReporter } from "./diagnostic.js";
import { WorkspaceQueueConsumer } from "./queue/consumer.js";
import { WorkspaceQueueFileSystem } from "./queue/file-system.js";
import { locateRemoteWorkspaceQueue } from "./queue/location.js";
import { ExtensionWorkspaceConsumer } from "./workspace-consumer.js";

const resolveExtensionWorkspace = async ({
  name,
  uri,
}: Pick<WorkspaceFolder, "name" | "uri">): Promise<{
  /**
   * Notification identity and display metadata for the workspace folder.
   */
  context: WorkspaceContext;

  /**
   * Queue resource owned by the workspace folder filesystem provider.
   */
  queueDirectory: Uri;
}> => {
  if (uri.scheme === "file") {
    const { context, queueDirectory } = await resolveWorkspaceQueue({
      directory: uri.fsPath,
    });

    return { context, queueDirectory: Uri.file(queueDirectory) };
  }

  const { instanceId } = identifyWorkspace({
    path: uri.path,
    platform: "posix",
  });
  const labelResult = WorkspaceLabel.safeParse(name);

  return {
    context: WorkspaceContext.parse({
      display: {
        branch: null,
        label: labelResult.success ? labelResult.data : null,
      },
      instanceId,
    }),
    queueDirectory: locateRemoteWorkspaceQueue({
      instanceId,
      useRemotePath: (path) => uri.with({ fragment: "", path, query: "" }),
    }),
  };
};

const createWorkspaceQueue = ({
  fileSystem,
  folder,
}: {
  fileSystem: WorkspaceQueueFileSystem<Uri>;
  folder: WorkspaceFolder;
}): Pick<NotificationQueue<Uri>, "claim"> => {
  let queue: NotificationQueue<Uri> | null = null;

  return {
    claim: async () => {
      queue ??= new NotificationQueue({
        directory: (await resolveExtensionWorkspace(folder)).queueDirectory,
        fileSystem,
      });

      return queue.claim();
    },
  };
};

const readCommandWorkspace = (): WorkspaceFolder | null => {
  const activeDocument = window.activeTextEditor?.document;
  if (activeDocument !== undefined) {
    const folder = workspace.getWorkspaceFolder(activeDocument.uri);
    if (folder !== undefined) {
      return folder;
    }
  }

  return workspace.workspaceFolders?.[0] ?? null;
};

const readDeliveryConfig = (): NotificationDeliveryConfig => {
  const config = workspace.getConfiguration("busyOctopus");

  return NotificationDeliveryConfig.parse({
    disableDetails: config.get<unknown>("disableDetails"),
    disableFocusSuppression: config.get<unknown>("disableFocusSuppression"),
    editor: {
      enable: config.get<unknown>("editor.enable"),
    },
  });
};

/**
 * Start queue consumption for trusted workspace folders.
 */
export const activate = (context: ExtensionContext): void => {
  const diagnosticReporter = new ExtensionDiagnosticReporter(
    window.createOutputChannel("Busy Octopus", { log: true }),
    window,
  );

  const editorDelivery = new EditorNotificationAdapter(window);

  const dispatcher = new NotificationDeliveryDispatcher({
    adapterList: [editorDelivery],
    diagnose: diagnosticReporter.report,
    readConfig: readDeliveryConfig,
    readFocus: () => window.state.focused,
  });

  const fileSystem = new WorkspaceQueueFileSystem({
    fileSystem: workspace.fs,
    join: Uri.joinPath,
  });

  const consumer = new ExtensionWorkspaceConsumer({
    createConsumer: (folder) =>
      new WorkspaceQueueConsumer({
        diagnose: diagnosticReporter.report,
        intervalMilliseconds: 1_000,
        onRequest: (notification, signal) =>
          dispatcher.deliver({
            notification,
            signal,
            target: workspace.workspaceFile ?? folder.uri,
          }),
        queue: createWorkspaceQueue({ fileSystem, folder }),
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

  context.subscriptions.push(
    commands.registerCommand("busyOctopus.showTestNotification", async () => {
      const folder = readCommandWorkspace();
      if (folder === null) {
        void window.showErrorMessage(
          "Busy Octopus needs an open workspace to send a test notification.",
        );
        return;
      }

      const { context: workspaceContext } =
        await resolveExtensionWorkspace(folder);

      await dispatcher.deliver({
        notification: createNotificationRequest({
          body: "Notification delivery is working.",
          source: null,
          title: "Busy Octopus",
          workspace: workspaceContext,
        }),
        signal: new AbortController().signal,
        target: workspace.workspaceFile ?? folder.uri,
      });
    }),
    consumer,
    dispatcher,
    diagnosticReporter,
  );
};
