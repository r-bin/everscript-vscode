#!/usr/bin/env bash
# Run the test suite, then the static checks the release ritual requires.
#   scripts/test.sh          tests + typecheck + circular-dependency scan
#   scripts/test.sh --quick  tests only
#   scripts/test.sh --all    also the advisory scans (knip dead code, depcruise boundaries)
source "$(dirname "$0")/_common.sh"
mode=${1:-default}
step "npm test"; $NPM test
[ "$mode" = --quick ] && exit 0
step "typecheck"; $NPM run typecheck
step "circular dependencies"; $NPM run check:circular
if [ "$mode" = --all ]; then
  step "dead code (advisory)"; $NPM run check:dead || true
  step "domain boundaries (warn level)"; $NPM run check:deps || true
fi
step "all required checks passed"
