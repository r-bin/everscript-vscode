#!/usr/bin/env bash
# Autonomous decompilation loop wrapper: runs continue the decompilation until quota or completion.
source "$(dirname "$0")/_common.sh"

step "Starting autonomous decompilation loop"
node scripts/auto-decompile.js "$@"

