---
name: busy-octopus
description: "Send an intermediate local workspace notification through the installed Busy Octopus CLI only when the user asks to be alerted while work continues after the event. Never notify immediately before ending or yielding a turn; agent lifecycle hooks already cover that transition."
---

# Busy Octopus Notifications

Busy Octopus is a local notification bridge for VS Code workspaces. The `busy-octopus notify` CLI command publishes a notification request for a workspace, and the Busy Octopus VS Code extension displays it to the user. Agent lifecycle hooks normally notify the user when a turn finishes or requires attention.

## Avoid Lifecycle Hook Duplicates

Do not call `busy-octopus notify` when the next action is to send a response, ask a question, request authorization, wait for user input, or end the turn. The lifecycle hook covers that transition, including successful completion, failure, blockers, completed monitoring, and a pull request becoming ready for review. A direct notification at that point creates a duplicate alert.

When uncertain whether a lifecycle hook covers an event, do not send a direct notification.

Use a direct notification only when either condition applies:

- The user explicitly asked for an alert at an intermediate milestone and substantial work will continue in the same active turn after that milestone.
- The user explicitly asked for a Busy Octopus notification and stated that lifecycle hooks are unavailable or disabled.

Send at most one notification for the same event.

## Send an Intermediate Notification

Run the command from the workspace that should receive the notification. When the current directory is elsewhere, pass the target workspace with `--directory`.

```shell
busy-octopus notify \
  --title "Import complete" \
  --body "The data import finished; validation is still running."
```

Write a short title that identifies the event and a concise body that tells the user what changed. Summarize status in your own words. Never include credentials, personal information, prompt text, full agent output, raw command output, or other sensitive content.

Notification delivery is best effort. If the command is unavailable or fails, continue the original task and do not install software, change notification configuration, or repeatedly retry unless the user asks.
