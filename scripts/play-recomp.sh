#!/usr/bin/env bash
# Start the recompiled game built by scripts/build-recomp.sh (extra args go to the executable).
source "$(dirname "$0")/_common.sh"
dir=$(ls -d out/recomp/SecretOfEvermore-* 2>/dev/null | head -1)
[ -n "$dir" ] || { echo "no game in out/recomp/ - run scripts/build-recomp.sh first" >&2; exit 1; }
for s in play.command play.sh; do [ -x "$dir/$s" ] && exec "$dir/$s" "$@"; done
echo "no start script in $dir" >&2; exit 1
