# Busy Octopus

**Don’t ping us. We’ll ping you.**

Busy Octopus is a local notification bridge for developers juggling workspaces, agents, terminals, tests, builds, and long-running scripts. It is being designed to deliver notifications from native workspaces, WSL, and Dev Containers through the desktop host without a cloud service, network daemon, or host-side CLI installation.

The repository currently contains the development setup only. It does not yet provide a working notifier, CLI, library, or VS Code extension.

## Development

Use the Dev Container, or install Node.js 22.12 or later and the pnpm version declared in `package.json`.

```shell
pnpm install --frozen-lockfile
pnpm verify
```

The implementation is developed in focused pull requests. Publishing packages, creating Marketplace records, reserving names, and changing external services are separate operations.

## License

[MIT](LICENSE)
