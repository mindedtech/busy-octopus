#!/usr/bin/env bash

set -euo pipefail

# Dev Container lifecycle commands may run without an interactive terminal.
CI=true pnpm install --frozen-lockfile
