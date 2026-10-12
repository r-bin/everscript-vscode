#!/usr/bin/env bash
# Compare the recomp's WRAM with snes9x frame by frame (npm run recomp:lockstep).
#   scripts/lockstep.sh [rom] [-- --from 295 --to 479 --step 10]
source "$(dirname "$0")/_common.sh"
rom="${SOE_ROM:-out/rom.sfc}"
if [ $# -gt 0 ] && [ "$1" != -- ]; then rom="$1"; shift; fi
[ "${1:-}" = -- ] && shift
$NPM run recomp:lockstep -- --rom "$rom" "$@"
