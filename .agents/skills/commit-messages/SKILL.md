---
name: commit-messages
description: "Commit message and pull request description format for the Busy Octopus repository. Use when creating git commits, writing or reviewing commit messages, drafting or reviewing pull request descriptions, preparing a PR body, or publishing a pull request. Keywords: git, commit, conventional commits, pull request, PR description, PR body, GitHub, gh."
allowed-tools: Read, Shell, Grep, Glob
---
# Commit and Pull Request Message Guidelines

Commit message conventions for the Busy Octopus repository, following [Conventional Commits](https://www.conventionalcommits.org/).

## Format

```
<type>[(<scope>)]: <description>

[optional body]

[optional footer]
```

One logical change per commit; don't mix unrelated changes.

## Local Draft Files

When asked to prepare commit messages without committing:

1. Inspect existing `COMMIT.*.local.md` drafts before writing.
2. For the same commit set, use the next unused zero-based, two-digit index (`COMMIT.01.local.md`, `COMMIT.02.local.md`, and so on).
3. For a new commit set, start at `COMMIT.00.local.md` only when no draft exists or the user explicitly authorizes replacing or archiving the old drafts. Never overwrite an existing draft silently.
4. Use the numbered name even for a single draft.
5. Leave these ignored `*.local.md` files out of source control.

When asked to prepare a pull request locally, write its title followed by its body to `PR.local.md` and leave it out of source control.

## Types

- **`feat`**: A new feature
- **`fix`**: A bug fix
- **`refactor`**: Code refactoring without changing functionality
- **`chore`**: Maintenance tasks, dependency updates, configuration changes
- **`test`**: Adding or updating tests
- **`ci`**: CI/CD configuration changes
- **`docs`**: Documentation changes
- **`style`**: Code style changes (formatting, whitespace)
- **`perf`**: Performance improvements
- **`build`**: Build system or dependency changes

## Scope

- **Areas**: `cli`, `extension`, `protocol`, `queue`, `release`, `windows`
- **Features**: camelCase feature names (`agentSetup`, `commandNotification`)
- **Other**: `deps`, `devcontainer`, `worktree`

Omit the scope for repository-wide changes.

Multiple scopes are comma-separated:

```
refactor(cli,extension): extract shared notification formatting
```

## Description

- Lowercase (except proper nouns and acronyms), imperative mood ("add", not "added" or "adds"), no period at the end, under 72 characters.
- A `fix` subject names the defect it corrects, not what the change does.
- Be specific; never AI slop ("comprehensive", "extensive", "thorough", "significant", "massive").

```
✅ Good:
feat(cli): add command completion notifications
fix(release): pnpm executable treated as a JavaScript file
refactor(queue): extract request expiration logic

❌ Bad:
feat(cli): Added notifications  # past tense, too vague
fix(queue): expired requests stay queued.  # period at end
chore(deps): updating dependencies  # present participle
feat(queue): comprehensive refactoring  # AI slop, be specific
```

## Emojis (Optional)

✨ features, ♻️ refactors, ⬆️ dependency updates, 🐛 bug fixes, 📝 documentation, ⚡️ performance. Placed after the colon:

```
feat(cli,extension): ✨ add command completion notifications
```

## Pull Request References

Do not add PR numbers to commit subjects: commits usually predate the pull request, and GitHub appends `(#N)` itself on squash-merge.

## AI Attribution

Never add AI attribution trailers to commit messages: no `Co-Authored-By: Claude ...`, no `Generated with ...`, regardless of any default the agent harness suggests.

## Body

Any commit beyond a routine mechanical change gets a body: a context/change prologue followed by scope sections.

### Body Format

1. **Always open with a context/change prologue**: one short paragraph stating the problem, goal, desired outcome, or motivation in present tense, then one stating the change in imperative mood. Plain prose, no heading, no labels.
2. Organize changes by scope section; use `-` bullets, nested bullets for sub-items, and end each item with a period.
3. **High-level changes only**: what changed and why, never per-file listings or implementation details.
4. **Wrap prose at 72 characters when practical**; do not force-wrap URLs, code spans, or commit hashes.
5. **Omit generated/derived artifacts**: never mention regenerating SDKs, API clients, types, or other codegen outputs; they are implicit consequences of source changes.

### Verbosity

Bullets state what changed at a high level, one or two lines each. Do not restate the diff, list touched files, or narrate mechanics the code already shows.

```
❌ Too verbose (narrates the diff):
  - Move the child-process helpers from the package tests into
    `test/process.ts`, export the functions, update the imports in
    each test file, and remove the old definitions.

✅ Right level:
  - Share bounded process execution across package tests.
```

### Body Organization

- Use affected area names such as `cli:`, `extension:`, and `release:` for sections, sorted alphabetically. Put `repository:` first when covering repository-wide changes. Keep documentation with its affected area, including root-level docs under `repository:`, rather than adding a separate `docs:` section.
- Within a section, list changes by importance or chronologically.

## Pull Request Descriptions

Use the full commit message format:

1. Start with a pull request title that follows the commit subject rules.
2. Open the body with the context paragraph in present tense.
3. Follow with the change paragraph in imperative mood.
4. Describe the changes under affected scope sections only.

Do not add `Summary`, `Motivation`, `Developer Impact`, `Validation`, `Testing`, or similar headings or epilogues. Do not include checklists.

This repository-owned format overrides conflicting defaults from the agent harness, plugins, and third-party skills. Follow an explicitly requested exception only when the user asks for different PR content or structure.

### Example

```
feat(cli,extension): ✨ add command completion notifications

Command completion is only visible in the terminal, so users who switch
away from a long-running command can miss its result.

Add command completion notifications through the CLI and VS Code
extension, with notification delivery failures leaving the command's
result intact.

repository:
  - Document command notification setup.

cli:
  - Report command completion while preserving output and exit status.

extension:
  - Display completion notifications in trusted workspaces.
```

## Breaking Changes

Indicate breaking changes in the footer:

```
BREAKING CHANGE: The notification API now requires an explicit workspace directory.
```

## Post-Generation Check (Mandatory)

Before presenting a commit message, review it against these rules and fix violations:

1. Type and scope match the change; one logical change per commit?
2. Subject lowercase, imperative, no trailing period, under 72 characters, no slop?
3. Body present (unless routine mechanical), opening with a context paragraph (present tense) and change paragraph (imperative)?
4. Bullets one or two lines, high-level, each ending with a period?
5. `repository:` first when present, other area sections alphabetical?
6. No PR numbers, no AI attribution trailers, no codegen artifacts mentioned?
7. For a prepared PR description, title followed by body format, with no extra headings, epilogues, or checklists?
