# Troubleshooting

Start with:

1. Run `busy-octopus doctor` in the same environment as the agent or command.
2. Open **Output: Show Output Channels** in VS Code and select **Busy Octopus**.
3. Run **Busy Octopus: Show Test Notification**.

Do not share prompts, agent output, hook payloads, queue files, credentials, or full environment dumps in bug reports.

## CLI not found

- Run `busy-octopus --help` in the agent environment.
- For WSL or a Dev Container, install the CLI inside that environment.
- If pnpm has no global bin directory, run `pnpm setup`, restart the terminal, and install again.

## Agent hook does not run

- Run the matching setup command again and review its result.
- In Codex, open `/hooks` and trust the Busy Octopus hooks.
- In Claude Code, accept workspace trust for the project configuration.
- Run the agent from the workspace where the hook file was configured.

## VS Code does not consume notifications

- Trust the workspace. Busy Octopus does not consume requests in Restricted Mode.
- Open a filesystem workspace. Virtual workspaces are not supported.
- Check `busyOctopus.focusSuppression.enable` when testing the target window while it has focus.
- On macOS and Linux, enable `busyOctopus.editor.enable`.

## Windows delivery

- Check the native notification, sound, and taskbar settings separately.
- Click a toast to test routing to the correct workspace.
- Focus a workspace window once after extension activation before testing taskbar flashing for that window.
