# Busy Octopus

**Multitask like an octopus.**

Busy Octopus is a VS Code extension that notifies you when an agent or workspace needs your attention. It is designed for developers juggling workspaces, agents, terminals, tests, builds, and long-running scripts.

The extension acts as a local notification bridge, delivering requests from native workspaces, WSL, and Dev Containers through the VS Code UI host without a cloud service, network daemon, or host-side CLI installation.

Current repository status:

- [x] Development setup
- [x] Internal generic notification protocol foundation
- [x] Internal workspace resolution foundation
- [x] Internal notification queue foundation
- [x] Programmatic notification library foundation
- [x] VS Code queue consumer foundation
- [ ] Working notifier
- [x] CLI
- [ ] Visible VS Code notifications

## Library

The package exposes a named asynchronous `notify` function for publishing a generic request to the OS-temporary queue associated with a workspace. The package is not published yet, and this foundation does not display notifications until the VS Code extension consumer exists.

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

## CLI

The package provides the same notification publisher as the `busy-octopus` executable. It currently writes to the internal local queue; visible delivery still requires the future VS Code extension consumer.

```shell
busy-octopus notify \
  --title "Agent finished" \
  --body "Review the result when ready."
```

Omit `--directory` to use the current working directory. Run `busy-octopus notify --help` for workspace, source, and retry-identifier options. A successful invocation prints the notification identifier; invalid arguments and publication failures return nonzero exit codes.

Check workspace resolution and queue routing without publishing a request:

```shell
busy-octopus doctor
```

The diagnostic output reports only whether workspace resolution and queue routing succeeded. It does not print workspace paths, display metadata, notification content, or queue identifiers.

## VS Code extension

The extension foundation runs in the local VS Code UI host and consumes queues for trusted workspace folders through `workspace.fs`. This lets native, WSL, and Dev Container workspaces use the same local bridge while keeping queue access in the editor process.

The extension does not consume queues in Restricted Mode or virtual workspaces. It tracks workspace-folder changes, cancels polling when a folder closes, and reports only fixed, content-free diagnostic codes.

This branch does not display notifications. Editor delivery and focus rules are the next implementation step.

## Development

Use the Dev Container, or install Node.js 22.12 or later and the pnpm version declared in `package.json`.

```shell
pnpm install --frozen-lockfile
pnpm verify
pnpm run cli --help
pnpm measure:cli:cold-start
pnpm package:vsix
pnpm test:extension
```

The implementation is developed in focused pull requests. Publishing packages, creating Marketplace records, reserving names, and changing external services are separate operations.

## License

[MIT](LICENSE)
