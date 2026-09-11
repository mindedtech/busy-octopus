# Contributing

Use the Dev Container, or install Node.js 22 or later and the pnpm version declared in `package.json`.

Run the complete local verification before pushing. It installs the exact lockfile, runs every check and test, and audits production dependencies:

```shell
pnpm verify
```

See [Releasing](docs/RELEASING.md) for release verification and publication.

Keep changes focused and add tests when behavior is introduced or changed. Do not add prompts, agent output, credentials, environment dumps, personal paths, or real hook payloads to source, fixtures, logs, or documentation.

`pnpm outdated` is a separate dependency-maintenance report: it exits unsuccessfully when updates exist, including deliberately skipped major versions.

Busy Octopus is a local-only VS Code extension backed by a generic notification bridge. Preserve its generic core, workspace-scoped queue, VS Code UI-host routing, Workspace Trust requirement, fail-open integrations, privacy boundaries, and independent delivery adapters.
