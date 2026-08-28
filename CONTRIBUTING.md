# Contributing

Use the Dev Container, or install Node.js 22.12 or later and the pnpm version declared in `package.json`.

Run the complete local verification before submitting a change:

```shell
pnpm install --frozen-lockfile
pnpm verify
```

Keep changes focused and add tests when behavior is introduced or changed. Do not add prompts, agent output, credentials, environment dumps, personal paths, or real hook payloads to source, fixtures, logs, or documentation.

Busy Octopus is a local-only VS Code extension backed by a generic notification bridge. Preserve its generic core, workspace-scoped queue, VS Code UI-host routing, Workspace Trust requirement, fail-open integrations, privacy boundaries, and independent delivery adapters.
