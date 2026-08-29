# Busy Octopus Agent Guide

These rules apply to the entire repository.

## Responsibilities and safety

- Preserve user work and avoid unrelated changes.
- **Never create or amend a Git commit unless the user's current message explicitly instructs you to commit.** Requests to implement work, complete a numbered step, prepare a commit, follow a commit plan, or continue after discussing commits do not authorize a commit. After implementing and validating changes, stop with the work uncommitted unless that immediate instruction is present.
- **Never create an unsigned Git commit or bypass commit signing.** If signing fails or the signing key is unavailable, check whether `.env.local` defines `GH_TOKEN` without reading, printing, or logging its value, and use it only through a workflow that still creates a signed commit. If no signed path is available, stop and report the failure without creating the commit.
- Never rewrite Git history or run destructive Git commands unless the user explicitly requests the exact operation.
- Commits on an unmerged pull request branch remain rewriteable even when pushed. Keep recommendations about commit structure separate from permission to amend, rebase, force-push, or otherwise mutate Git history.
- Inspect with read-only commands before acting when scope or impact is uncertain.
- Do not write personal information, machine-specific absolute paths, credentials, prompts, assistant-message previews, or sensitive hook data into source, tests, fixtures, logs, or documentation.
- Keep generated output separate from authored files and never edit generated files manually.

## Project

- Build Busy Octopus as one flat pnpm package in strict TypeScript unless an independently versioned component genuinely requires a separate package.
- Use Biome for formatting and linting, Vitest for tests, and esbuild for the distributable CLI and VS Code extension bundles.
- Publish `@mindedtech/busy-octopus` with the `busy-octopus` executable and the `mindedtech.busy-octopus` VS Code extension from one synchronized version.
- Keep the public core generic. Codex, Claude Code, and future tools are integrations that adapt their events into notification requests.
- Keep the queue protocol internal until the public library contract is stable.
- Run the extension in the local UI host and access native or remote temporary queues through `workspace.fs`.
- Keep the system local by default. Do not add telemetry, a hosted service, network listener, cloud relay, or background daemon.
- Support VS Code and VS Code Insiders only. Do not claim Open VSX, Cursor, or other VS Code-derived editor support.
- Provide editor messages on Windows, macOS, and Linux, plus native Windows toasts. Native macOS and Linux notification adapters are deferred.

## Critical invariants

- Integrations must fail open: notifier setup or delivery failures must never stop or fail an upstream task or agent turn.
- Configure only turn-finished hooks by default. Attention-required hooks require explicit product-level opt-in.
- Keep Git optional. Use it only for metadata and always associate requests with the active checkout or linked worktree.
- Do not create a Busy Octopus configuration or queue directory in the repository by default. Store runtime requests in the derived OS-temporary queue.
- Preserve strict, versioned Zod validation, bounded request sizes, atomic publication and claims, stale-request expiration, abandoned-claim recovery, duplicate suppression, queue bounds, and bounded cleanup.
- Treat queue data as untrusted local input. Do not interpolate it into a shell command.
- Pass native-process arguments separately and preserve XML sanitization for Windows toasts.
- Require Workspace Trust before consuming repository-associated requests.
- Include bounded, sanitized notification details by default when available and support explicit opt-out.
- Keep diagnostics local, content-free, and bounded. Never log prompts, agent output, raw hook payloads, credentials, environment dumps, or notification previews.
- Keep delivery adapters independent so one adapter failure does not prevent another enabled adapter from running.
- Dispose timers, listeners, cancellation sources, file handles, and VS Code disposables through explicit lifecycle owners.

## Workflow

- Read and follow `.agents/skills/coding-style/SKILL.md` when writing, modifying, or reviewing TypeScript and tests.
- Read and follow `.agents/skills/code-docs/SKILL.md` when writing or reviewing code documentation.
- Read and follow `.agents/skills/commit-messages/SKILL.md` when drafting, reviewing, or creating commits and pull requests.
- Read and follow `.agents/skills/update-deps/SKILL.md` when reviewing or updating dependencies, package-manager versions, runtime images, Actions, or repeated tool pins.
- After generating or modifying code, always complete the final review required by every applicable skill across all authored files in scope before presenting the result. Passing automated checks does not replace this review.
- Keep shared configuration, test infrastructure, and their documentation scoped to stable project-wide concerns. Do not name, describe, or constrain shared tooling around the current feature unless the behavior is genuinely feature-specific.
- Write inventories as Markdown lists instead of prose. Use task checkboxes when the inventory communicates completed and incomplete work or available and unavailable capabilities.
- Use root `pnpm` scripts as the development interface; do not add Taskfile, ESLint, Prettier, shared configuration packages, or a second TypeScript version.
- Make small, focused changes and add or update tests for changed behavior.
- Use `pnpm verify` as the complete local verification command before pushing; it must include a frozen install, all ordinary checks and tests, and the production dependency audit. Report any check not run or any failure.
- Before adding or upgrading a dependency, verify its current supported usage in official documentation, the package registry, and upstream release notes.
- Pin dependencies exactly unless a documented release workflow requires otherwise.
- Verify both npm tarball and VSIX contents with explicit allow-lists before release.
- Update public documentation when implemented behavior, compatibility, setup, or architecture changes.
- Do not publish packages, reserve public names, create Marketplace records, or change external services without explicit user authorization.

## Maintaining this file

- Keep this guide concise and limited to durable repository-wide rules.
- When a durable rule changes, replace the stale rule instead of appending a conflicting exception.
- Do not add transient task details or inferred personal preferences.
