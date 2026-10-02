# Changelog

## Unreleased

## 0.1.4

### Fixed

- Claude Code turn notifications no longer fail when Claude Code sends a hook field that Busy Octopus does not know.

### Changed

- A failed agent hook now reports the failure type and the hook fields that failed validation.

## 0.1.3

### Added

- An optional agent skill for intermediate notifications while work continues.

## 0.1.2

### Added

- `-v` and `--version` options for the Busy Octopus CLI.

### Changed

- The minimum supported VS Code version is now 1.137.

## 0.1.1

### Added

- An octopus icon with ringing arcs for the VS Code extension.

## 0.1.0

### Added

- VS Code notifications for trusted local, WSL, and Dev Container workspaces.
- Native Windows notifications with optional sound and workspace routing.
- Windows taskbar flashing for the workspace that needs attention.
- Codex and Claude Code hook setup.
- Command completion notifications through `busy-octopus run`.
- A Node.js notification API and CLI.

Future releases use headings in the form `## <version>`.
