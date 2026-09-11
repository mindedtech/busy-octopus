# Privacy

Busy Octopus runs locally. It has no telemetry, cloud relay, network listener, or background daemon.

## Notification data

A notification may contain:

- A title and optional details.
- A source name and source type.
- A workspace label, Git branch, and internal workspace identifier.
- A notification identifier and creation time.

Publishers write bounded notification files to a Busy Octopus queue below the operating system's temporary directory. The VS Code extension claims and removes them. Expired requests and abandoned claims are removed by bounded queue cleanup.

On Windows, notification text is passed to the bundled local PowerShell script and Windows notification APIs. Clicking a native notification sends a local VS Code URI back to the matching workspace window.

The Busy Octopus output channel contains fixed diagnostic codes. It does not contain notification text, prompts, agent output, hook payloads, credentials, environment dumps, or queue contents.

## Other software

Busy Octopus does not control network access by npm, GitHub, VS Code, the VS Code Marketplace, Codex, Claude Code, or other tools. Their own privacy terms apply when you install, update, configure, or use them.
