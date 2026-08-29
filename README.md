# Busy Octopus

**Multitask like an octopus.**

Busy Octopus is a VS Code extension that notifies you when an agent or workspace needs your attention. It is designed for developers juggling workspaces, agents, terminals, tests, builds, and long-running scripts.

The extension acts as a local notification bridge, delivering requests from native workspaces, WSL, and Dev Containers through the VS Code UI host without a cloud service, network daemon, or host-side CLI installation.

Current repository status:

- [x] Development setup
- [x] Internal generic notification protocol foundation
- [ ] Working notifier
- [ ] CLI
- [ ] Library
- [ ] VS Code extension

## Development

Use the Dev Container, or install Node.js 22.12 or later and the pnpm version declared in `package.json`.

```shell
pnpm install --frozen-lockfile
pnpm verify
```

The implementation is developed in focused pull requests. Publishing packages, creating Marketplace records, reserving names, and changing external services are separate operations.

## License

[MIT](LICENSE)
