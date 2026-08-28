---
name: update-deps
description: "Update Busy Octopus package-manager, npm, Dev Container, and build-tool dependencies safely. Use for routine dependency maintenance, outdated-package reviews, or vulnerability remediation. Keywords: dependencies, pnpm, outdated, audit, upgrade, package.json, lockfile, Dockerfile, Dev Container."
---

# Update Dependencies

Update dependencies conservatively while preserving the supported Node.js and VS Code versions, exact pins, reproducible artifacts, and a reviewable lockfile. This workflow does not authorize commits, pushes, publication, major upgrades, or destructive cleanup.

## Before changing files

1. Inspect the worktree and preserve unrelated user changes.
2. Read `package.json`, `pnpm-lock.yaml`, the Dev Container files, build scripts, and CI workflows that repeat dependency or runtime versions.
3. Run the current `pnpm verify` when available. Record pre-existing failures instead of attributing them to the update.
4. Query the package registry with `pnpm outdated` and `pnpm view`; do not rely on remembered versions. Run the repository's dependency audit when one is configured.

If the registry, advisory source, or upstream release notes cannot be reached, stop before changing versions unless the user explicitly accepts an offline, partial update.

## Select updates

- Update stable patch and minor releases by default.
- Do not update a dependency across a major version without explicit approval.
- Keep `@types/node` on the published CLI's supported Node.js major unless the project deliberately changes that runtime floor.
- Treat changes to `@types/vscode` and VS Code APIs separately from ordinary package bumps. Do not raise `engines.vscode` until the implementation and compatibility tests justify a new minimum.
- Preserve exact dependency pins and alphabetic ordering in `package.json`.
- Keep repeated pins synchronized, including pnpm, Node.js images, GitHub Actions inputs, and versions embedded in build or packaging scripts.
- Review Docker and Dev Container image tags and installed tools. Patch or minor updates are eligible; distribution and runtime-major changes require approval.
- Do not add an override merely to silence an incompatibility. Add the narrowest override needed for a confirmed security advisory only after explaining it.
- Report prereleases, majors, incompatible peer ranges, and deliberately pinned packages as skipped rather than forcing them into the batch.

Read the upstream changelog or release notes for every direct dependency being updated. Pay particular attention to breaking behavior hidden in minor releases, new runtime requirements, deprecated APIs, security fixes, and packaging or extension-host changes.

## Apply updates

Edit the dependency sources of truth, then run `pnpm install` to update the lockfile. Do not manually edit `pnpm-lock.yaml`.

Never delete the lockfile, `node_modules`, or the pnpm store as a routine repair. If resolution is surprising, inspect the dependency graph with `pnpm why` and fix the declared constraint. Ask before destructive cleanup.

Keep the batch limited to dependency-driven changes. Small API or configuration adjustments required by an eligible update belong in the batch; a migration, architecture change, or substantial compatibility workaround should stop and be proposed separately.

## Validate

1. Re-run the dependency audit and confirm that the update did not introduce a known vulnerability.
2. Run `pnpm verify`, including linting, type checks, tests, builds, npm packing, VSIX packaging, and artifact allow-list checks once those gates exist.
3. Exercise additional platform-specific checks when the changed dependency affects Windows process invocation, remote filesystem behavior, the VS Code extension host, or supported Node.js compatibility.
4. Run `pnpm outdated` again to produce the final skipped-update list.
5. Review the diff for unintended manifest, lockfile, generated-artifact, and formatting changes.

Do not weaken checks, change static-analysis configuration, remove assertions, or hand-edit generated artifacts to make validation pass. If a patch no longer applies or an update requires a non-trivial workaround, revert that dependency update and report why it was skipped.

## Handoff

Report:

- every updated direct dependency and its old and new versions;
- meaningful release-note or security information;
- every available update that was skipped and the concrete reason;
- synchronized non-package pins, such as the Dev Container image or pnpm version;
- commands run and any failures or checks that could not run.

When drafting a commit or pull request, also follow the `commit-messages` skill. Do not commit, push, or publish unless the user explicitly requests it.
