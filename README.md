# Busy Octopus

**Multitask like an octopus.**

VS Code extension that notifies you when an agent or workspace needs your attention. Supports local workspaces, WSL, and Dev Containers without a cloud service or background daemon.

## Setup

Busy Octopus is not published yet.

### 1. Install the extension

Requires Node.js 22 or later and the pnpm version declared in `package.json`.

```shell
pnpm install --frozen-lockfile
pnpm package:vsix
```

In VS Code:

1. Run **Extensions: Install from VSIX...** from the Command Palette.
2. Select `artifacts/busy-octopus-<version>.vsix`.
3. Open and trust the workspace that should receive notifications.

Notifications are not consumed in Restricted Mode or virtual workspaces.

### 2. Install the CLI

Install the CLI in the same environment as the agent. For WSL and Dev Containers, install it inside WSL or the container.

```shell
pnpm build
pnpm add --global .
busy-octopus --help
```

If pnpm cannot find its global bin directory, run `pnpm setup`, restart the terminal, and install again.

### 3. Configure agent hooks

From the workspace directory:

```shell
busy-octopus agent setup codex
busy-octopus agent setup claude-code
```

Run `busy-octopus agent setup --help` for options.

Existing settings and unrelated hooks are preserved. The generated files may be committed as shared project configuration. Each user still needs `busy-octopus` on the agent's `PATH`.

Approve the hooks after setup:

| Provider | Approval |
| --- | --- |
| Codex | Open `/hooks`, review the Busy Octopus hooks, and trust them. New or changed hooks do not run until trusted. |
| Claude Code | Accept the workspace trust prompt. Use `/hooks` to confirm that the project hooks are loaded. |

See the [Codex hook documentation](https://learn.chatgpt.com/docs/hooks) and [Claude Code hook documentation](https://code.claude.com/docs/en/hooks).

### 4. Verify setup

- [ ] Open and trust the target workspace.
- [ ] Run `busy-octopus doctor` in the agent environment.
- [ ] Run **Busy Octopus: Show Test Notification** from the VS Code Command Palette.
- [ ] Complete an agent turn and check that the correct workspace window receives the notification.

The test notification follows the normal delivery settings. While the target workspace window has focus, disable `busyOctopus.focusSuppression.enable` to see it.

## Agent events

Completion events are enabled by default:

| Provider | Event | Details |
| --- | --- | --- |
| Codex | `Stop` | Final response, when available. |
| Claude Code | `Stop` | Final response, when available. |
| Claude Code | `StopFailure` | Turn stopped with an error. |

`--enable-attention` adds:

| Provider | Event | Message |
| --- | --- | --- |
| Codex | `PreToolUse` for `request_user_input` or `request_user_input_async` | Input required. |
| Claude Code | `PreToolUse` for `AskUserQuestion` | Input required. |
| Claude Code | `Notification` for `permission_prompt` | Approval required. |
| Claude Code | Elicitation and agent-input notifications | Input required. |

## Settings

| Setting | Default | Effect when enabled |
| --- | --- | --- |
| `busyOctopus.editor.enable` | `false` | Show notifications in VS Code. |
| `busyOctopus.focusSuppression.enable` | `true` | Suppress notifications while the target workspace window has focus. |
| `busyOctopus.detail.enable` | `true` | Include notification details. |
| `busyOctopus.windows.notification.enable` | `true` | Show native Windows notifications. |
| `busyOctopus.windows.notification.sound.enable` | `false` | Play the default Windows notification sound. |
| `busyOctopus.windows.taskbar.flash.enable` | `true` | Flash the workspace taskbar button on Windows. |

On Windows, clicking a native notification opens the workspace that sent it, including WSL and Dev Container workspaces. Taskbar flashing can target a window after that window has received focus once during the extension session.

On macOS and Linux, enable `busyOctopus.editor.enable`; native notifications are not available yet.

## Direct notifications

```shell
busy-octopus notify \
  --title "Agent finished" \
  --body "Review the result when ready."
```

The current directory selects the workspace. Use `--directory <path>` to select another one. Run `busy-octopus notify --help` for all options.

## Library

The `busy-octopus notify` command calls the package's exported `notify()` function and exposes the same notification fields as command-line options. JavaScript and TypeScript integrations can call `notify()` directly instead of starting a CLI subprocess.

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

`directory` selects a workspace; the default is the current directory. Reuse `notificationId` when retrying the same notification.

## Development

```shell
pnpm install --frozen-lockfile
pnpm verify
pnpm measure:cli:cold-start
pnpm test:extension
```

## License

[MIT](LICENSE)
