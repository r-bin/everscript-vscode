#!/usr/bin/env bash
# Release ritual (.agents/skills/release-ritual/SKILL.md) after the work is committed:
# validate, push develop, install the extension. Does not bump the version or commit.
source "$(dirname "$0")/_common.sh"
[ -z "$(git status --porcelain)" ] || { echo "worktree not clean - commit first" >&2; exit 1; }
"$ROOT/scripts/test.sh"
step "push develop"; git push origin develop
step "install"; $NPM run deploy
