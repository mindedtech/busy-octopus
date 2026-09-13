<img src="https://raw.githubusercontent.com/mindedtech/busy-octopus/main/assets/icon.png" alt="Busy Octopus logo" width="128" height="128">

# Busy Octopus

**Multitask like an octopus.**

VS Code extension that notifies you when an agent or workspace needs your attention. Supports local workspaces, WSL, and Dev Containers without a cloud service or background daemon.

## Installation

Install Node.js 22 or later, then install the CLI:

```shell
npm install --global busy-octopus
```

In VS Code:

1. Open the Extensions view.
2. Search for `mindedtech.busy-octopus` and select **Install**.
3. Open and trust the workspace that should receive notifications.

Install the CLI in the agent environment. For WSL and Dev Containers, run `npm install --global busy-octopus` inside WSL or the container.

## Agent notifications

From the workspace directory:

```shell
busy-octopus agent setup codex
busy-octopus agent setup claude-code
```

Approve the new hooks:

| Provider | Approval |
| --- | --- |
| Codex | Open `/hooks`, review the Busy Octopus hooks, and trust them. |
| Claude Code | Accept the workspace trust prompt. |

Run `busy-octopus agent setup --help` for attention notifications and other options.

### Agent skill

The optional Busy Octopus skill lets an agent send direct notifications for requested intermediate milestones while work continues. Lifecycle hooks already cover turn completion and attention events, and the skill tells the agent to avoid duplicate alerts. Install it alongside lifecycle hooks:

```shell
busy-octopus agent setup codex --skill
busy-octopus agent setup claude-code --skill
```

Install the skill without changing hooks by choosing one or both project layouts:

```shell
busy-octopus agent skill --agents
busy-octopus agent skill --claude
```

Without a destination flag, `busy-octopus agent skill` prints the `SKILL.md` content to standard output. For other supported agent layouts, use the [skills CLI](https://github.com/vercel-labs/skills):

```shell
npx skills add mindedtech/busy-octopus --skill busy-octopus
```

## Command notifications

Wrap any command:

```shell
busy-octopus run -- pnpm test
```

Run `busy-octopus run --help` for output capture and notification options.

## Verify setup

- [ ] Run `busy-octopus doctor` in the agent environment.
- [ ] Run **Busy Octopus: Show Test Notification** in VS Code.
- [ ] Complete an agent turn and check the notification opens the correct workspace window.

The test notification uses the normal settings. Disable `busyOctopus.focusSuppression.enable` when testing with the target workspace window focused.

## Settings

| Setting | Default | Effect when enabled |
| --- | --- | --- |
| `busyOctopus.editor.enable` | `false` | Show notifications in VS Code. |
| `busyOctopus.focusSuppression.enable` | `true` | Suppress notifications while the target workspace window has focus. |
| `busyOctopus.detail.enable` | `true` | Include notification details. |
| `busyOctopus.windows.notification.enable` | `true` | Show native Windows notifications. |
| `busyOctopus.windows.notification.sound.enable` | `false` | Play the default Windows notification sound. |
| `busyOctopus.windows.taskbar.flash.enable` | `true` | Flash the workspace taskbar button on Windows. |

On Windows, clicking a native notification opens its workspace, including WSL and Dev Container workspaces. Taskbar flashing can target a window after it has received focus once during the extension session.

On macOS and Linux, enable `busyOctopus.editor.enable`; native notifications are not available yet.

Notifications are not consumed in Restricted Mode or virtual workspaces.

## Agent integration details

Completion notifications are configured by default:

| Provider | Event | Details |
| --- | --- | --- |
| Codex | `Stop` | Final response, when available. |
| Claude Code | `Stop` | Final response, when available. |
| Claude Code | `StopFailure` | Turn stopped with an error. |

The `--enable-attention` setup option adds:

| Provider | Event | Message |
| --- | --- | --- |
| Codex | `PreToolUse` for `request_user_input` or `request_user_input_async` | Input required. |
| Claude Code | `PreToolUse` for `AskUserQuestion` | Input required. |
| Claude Code | `Notification` for `permission_prompt` | Approval required. |
| Claude Code | Elicitation and agent-input notifications | Input required. |

Setup preserves unrelated settings and hooks. Its project configuration files may be committed, but every user still needs `busy-octopus` on the agent's `PATH`.

Provider documentation: [Codex hooks](https://learn.chatgpt.com/docs/hooks) and [Claude Code hooks](https://code.claude.com/docs/en/hooks).

## Command details

The wrapped command keeps its output and exit status. Notification errors do not change its result.

| Option | Notification content |
| --- | --- |
| `-H, --head` | Complete lines from the start, earliest first. |
| `-T, --tail` | Complete lines from the end, latest first. |

Output is limited to 1,024 characters; a single long line uses its prefix or suffix. The output options are mutually exclusive. Without either option, command output is not included in the notification. Use `-s, --success-only` or `-f, --failure-only` to restrict notifications.

## Direct notifications

```shell
busy-octopus notify \
  --title "Agent finished" \
  --body "Review the result when ready."
```

The current directory selects the workspace. Use `--directory <path>` to select another one. Run `busy-octopus notify --help` for all options.

## Library

The `busy-octopus notify` command uses the package's exported `notify()` function. JavaScript and TypeScript integrations can call the same API instead of starting the CLI as a subprocess.

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

## Help and project policies

- [Troubleshooting](https://github.com/mindedtech/busy-octopus/blob/main/docs/TROUBLESHOOTING.md)
- [Privacy](https://github.com/mindedtech/busy-octopus/blob/main/docs/PRIVACY.md)
- [Security](https://github.com/mindedtech/busy-octopus/blob/main/SECURITY.md)
- [Changelog](https://github.com/mindedtech/busy-octopus/blob/main/CHANGELOG.md)

## License

[MIT](LICENSE)
