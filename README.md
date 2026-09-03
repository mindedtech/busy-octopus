# Busy Octopus

**Multitask like an octopus.**

Busy Octopus is a VS Code extension that notifies you when an agent or workspace needs your attention. It supports local workspaces, WSL, and Dev Containers without a cloud service, network daemon, or host-side CLI installation.

## Setup

Busy Octopus is not published yet. To install the extension from this repository:

1. Install Node.js 22 or later and the pnpm version declared in `package.json`.
2. Build the VSIX:

   ```shell
   pnpm install --frozen-lockfile
   pnpm package:vsix
   ```

3. In VS Code, run **Extensions: Install from VSIX...** from the Command Palette.
4. Select `artifacts/busy-octopus-<version>.vsix`.
5. Open the workspace that should receive notifications and confirm that it is trusted.

The extension does not consume notifications in Restricted Mode or virtual workspaces.

## Usage

Run **Busy Octopus: Show Test Notification** from the Command Palette to send a test notification through the normal delivery path. The result follows the same settings as a real notification.

To publish a notification from this repository, run the CLI from a terminal associated with the target workspace:

```shell
pnpm run cli notify \
  --title "Agent finished" \
  --body "Review the result when ready."
```

Omit `--directory` to use the current working directory. Pass `--directory <path>` to select another workspace. Run `pnpm run cli notify --help` for source and retry-identifier options.

A successful invocation prints the notification identifier. Invalid arguments and publication failures return nonzero exit codes.

Check workspace resolution and queue routing without publishing a request:

```shell
pnpm run cli doctor
```

The diagnostic output reports only whether workspace resolution and queue routing succeeded. It does not print paths, display metadata, notification content, or queue identifiers.

## Settings

| Setting | Default | Effect when enabled |
| --- | --- | --- |
| `busyOctopus.editor.enable` | `false` | Show notifications in VS Code. |
| `busyOctopus.focusSuppression.enable` | `true` | Suppress notifications while the VS Code window has focus. |
| `busyOctopus.detail.enable` | `true` | Include notification details. |
| `busyOctopus.windows.notification.enable` | `true` | Show native Windows notifications. |
| `busyOctopus.windows.notification.sound.enable` | `false` | Play the default Windows notification sound. |
| `busyOctopus.windows.taskbar.flash.enable` | `true` | Flash the workspace taskbar button. |

On Windows, native notifications and taskbar flashing are enabled by default. Native notifications are silent unless sound is enabled. Clicking a notification returns to the workspace that sent it, including WSL and Dev Container workspaces.

Taskbar flashing targets the correct workspace window after that window has received focus once during the extension session.

## Library

The package exposes an asynchronous `notify` function for integrations that publish notifications programmatically. The package is not published yet.

```typescript
import { notify } from "busy-octopus";

const { notificationId } = await notify({
  title: "Agent finished",
  body: "Review the result when ready.",
  source: {
    kind: "agent",
    name: "Example agent",
  },
});
```

Pass `directory` to select a workspace explicitly; omitting it uses the current working directory. Pass a stable `notificationId` when retrying the same logical notification.

The promise rejects when input validation, workspace resolution, or queue publication fails. Integrations that must fail open should catch and diagnose those errors without failing the upstream task.

## How it works

The extension runs in the local VS Code UI host and consumes an OS-temporary queue for each trusted workspace folder through `workspace.fs`. Notification publishers write to the queue associated with a workspace; the extension then delivers the request through every enabled adapter.

Queue access stays in the editor process, so native workspaces, WSL, and Dev Containers use the same local bridge. The extension tracks workspace-folder changes, stops polling when a folder closes, and reports only fixed, content-free diagnostic codes.

## Development

Use the Dev Container, or install Node.js 22 or later and the pnpm version declared in `package.json`.

```shell
pnpm install --frozen-lockfile
pnpm verify
pnpm measure:cli:cold-start
pnpm test:extension
```

Publishing packages, creating Marketplace records, reserving names, and changing external services are separate operations.

## License

[MIT](LICENSE)
