#!/usr/bin/env bash

set -euo pipefail

mkdir -p "${HOME}/.claude" "${HOME}/.codex"

if [ ! -e "${HOME}/.claude.json" ]; then
  touch "${HOME}/.claude.json"
fi

if [ ! -e "${HOME}/.npmrc" ]; then
  touch "${HOME}/.npmrc"
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
workspace_dir="$(cd -- "$script_dir/.." >/dev/null && pwd)"
compose_override="$script_dir/compose.worktree.gen.local.yml"
# Compose project names must be stable per checkout but distinct across worktrees.
workspace_slug="$(
  printf '%s' "$(basename "$workspace_dir")" |
    tr '[:upper:]' '[:lower:]' |
    tr -c 'a-z0-9_-' '-' |
    cut -c1-40
)"
workspace_checksum="$(printf '%s' "$workspace_dir" | cksum | cut -d ' ' -f1)"
compose_project="${workspace_slug}-${workspace_checksum}"
git_dir=""
main_env_file=""

# A linked worktree stores its Git directory outside the mounted workspace.
if [ -f "$workspace_dir/.git" ]; then
  git_dir="$(git -C "$workspace_dir" rev-parse --path-format=absolute --git-common-dir)"
  main_workspace_dir="$(
    git -C "$workspace_dir" worktree list --porcelain |
      sed -n 's/^worktree //p' |
      head -n 1
  )"

  if [ -f "$main_workspace_dir/.env.local" ]; then
    main_env_file="$main_workspace_dir/.env.local"
  fi

  git_dir=${git_dir//\\/\\\\}
  # These paths are emitted as YAML double-quoted scalars below.
  git_dir=${git_dir//\"/\\\"}
  main_env_file=${main_env_file//\\/\\\\}
  main_env_file=${main_env_file//\"/\\\"}
fi

# Generate only the extra mounts a linked worktree needs.
{
  printf 'name: "%s"\n' "$compose_project"
  printf '%s\n' 'services:'

  if [ -z "$git_dir" ] && [ -z "$main_env_file" ]; then
    printf '%s\n' '  busy-octopus: {}'
  fi

  if [ -n "$git_dir" ] || [ -n "$main_env_file" ]; then
    printf '%s\n' \
      '  busy-octopus:' \
      '    volumes:'
  fi

  if [ -n "$git_dir" ]; then
    printf '%s\n' \
      '      - type: bind' \
      "        source: \"$git_dir\"" \
      "        target: \"$git_dir\""
  fi

  if [ -n "$main_env_file" ]; then
    printf '%s\n' \
      '      - type: bind' \
      "        source: \"$main_env_file\"" \
      '        target: "/workspace/.env.local"' \
      '        read_only: true'
  fi
} >"$compose_override"
