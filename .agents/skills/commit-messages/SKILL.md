---
name: commit-messages
description: Commit and pull request conventions for Busy Octopus. Use when creating, drafting, or reviewing commits, commit messages, pull request titles, or pull request descriptions.
---

# Commit messages and pull requests

Use Conventional Commits for commit subjects and pull request titles.

```text
<type>[(<scope>)][!]: <description>

[body]

[footer(s)]
```

Repository-owned conventions in this skill take precedence over generated
templates, harness defaults, plugin suggestions, and generic assistant habits.
Follow another format only when the user explicitly requests it.

Use plain English. Prefer short, common words and direct sentences. Avoid
jargon, idioms, metaphors, and vague phrases.

## Inspect the branch first

Before drafting a commit or pull request message:

1. Inspect the full branch diff against its base.
2. Inspect the existing commits and their messages.
3. Determine whether the requested message describes one commit or the entire
   branch.
4. Check whether existing commits may be rewritten. Never assume that a pushed
   or shared commit can be amended or rebased.

Describe the intended change, not merely the currently staged files.

## Local drafts

When asked to draft a message without committing:

- Write commit drafts to the next available `COMMIT.<number>.local.md` file.
- Never overwrite an existing numbered commit draft.
- Write pull request drafts to `PR.local.md` only when doing so will not
  overwrite user work.
- Keep draft files untracked and ignored by Git.

## Type

Use one of these types:

- `feat`: add user-visible behavior.
- `fix`: correct defective behavior.
- `docs`: change documentation only.
- `style`: change formatting without changing behavior.
- `refactor`: restructure code without adding behavior or fixing a defect.
- `perf`: improve performance.
- `test`: add or correct tests.
- `build`: change the build system or external dependencies.
- `ci`: change continuous-integration configuration.
- `chore`: perform repository maintenance not covered by another type.
- `revert`: revert an earlier commit.

Choose the type from the change's purpose, not the files it happens to touch.

## Scope

Omit the scope for a repository-wide change. Otherwise, prefer one of these
Busy Octopus scopes:

- `cli`
- `devcontainer`
- `deps`
- `extension`
- `protocol`
- `queue`
- `release`
- `windows`
- `workspace`

A different concise, lower-case scope is acceptable when none of these names
the affected area accurately. Use multiple scopes only when the change cannot
be described honestly with one scope.

## Description

Write the subject description in the imperative mood, in lower case, without a
terminal period. Keep the complete subject under 72 characters.

State the concrete outcome. Avoid vague or inflated wording such as:

- `comprehensive`
- `enhance`
- `improve`
- `robust`
- `streamline`
- `thorough`
- `various`

Name the defect for a fix; do not use `fix issue`, `fix bug`, or an equivalent
placeholder.

Good subjects:

```text
chore: set up the repository
feat(queue): persist request priorities
fix(windows): preserve UNC workspace paths
ci: verify the supported Node.js versions
```

Bad subjects:

```text
Updated files
feat: improve queue handling.
fix: fix issue
chore(repository): comprehensive repository setup
```

Do not add emoji, issue-tracker identifiers, pull request numbers, or AI
attribution unless the user explicitly requests them.

## Commit body

For every nontrivial commit, begin the body with exactly two prose paragraphs:

1. State the functional goal or context in the present tense. This may describe
   the desired user outcome, motivation, relevant current behavior, or a real
   problem.
2. Describe the change in the imperative mood.

Do not label these paragraphs with headings such as `Problem`, `Motivation`, or
`Solution`. Do not force the first paragraph to claim a defect or missing
capability. Use problem or limitation language only when it is central to the
change. Keep both paragraphs focused on intent and behavior. Do not narrate the
diff, list every file, or describe implementation mechanics that are obvious
from the code.

After the two paragraphs, add scope sections only when they materially clarify
a change spanning several areas. Use lower-case headings ending in a colon.
Put `repository:` first when present, then sort other headings alphabetically.
Write high-level bullet points ending in periods.

```text
repository:

- Add a reproducible contributor environment.
- Enforce the same checks locally and in CI.
```

Do not mention generated artifacts such as lockfile churn unless the artifact
itself is the purpose of the change. Wrap body text at 72 characters.

## Pull requests

Use the same Conventional Commit format for the pull request title. Describe
the whole branch rather than repeating individual commit messages.

Begin the description with the same two unlabelled paragraphs used for commit
bodies: the functional goal or context, then the change in the imperative
mood. Add affected-scope sections only when they help a reviewer understand a
multi-area change.

Do not add generic sections such as `Summary`, `Motivation`, `Developer Impact`,
`Validation`, or `Testing`. Do not include task checklists or performative claims
that checks passed. CI and the review interface already report verification.

Prefer a short, precise description over padding:

```text
The repository has no reproducible development baseline, so local and CI
behavior can diverge before product work begins.

Set up the minimum contributor infrastructure without adding notifier behavior.
```

## Breaking changes

Add `!` after the type or scope and include a `BREAKING CHANGE:` footer when a
change breaks a public contract. Explain what breaks and what callers must do.

## Final check

After generating or reviewing a commit message or pull request description,
verify all of the following:

- The title follows Conventional Commits and is under 72 characters.
- The title is imperative, lower case, specific, and has no terminal period.
- The type and optional scope describe the purpose accurately.
- A nontrivial body starts with an unlabelled functional goal or context
  paragraph in the present tense followed by an unlabelled change paragraph in
  the imperative mood.
- Optional scope sections are useful, high level, and consistently formatted.
- The message omits diff narration, generated-artifact noise, generic sections,
  checklists, issue or pull request numbers, and AI attribution.
- Every factual claim is supported by the inspected branch or commit.
