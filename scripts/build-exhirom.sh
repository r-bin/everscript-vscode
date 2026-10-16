#!/usr/bin/env bash
# Build the 8 MB ExHiROM version of Evermore (npm run exhirom) into out/soe-exhirom.sfc.
#   scripts/build-exhirom.sh [rom] [-- extra args for tools/exhirom/convert.js, e.g. out/other.sfc --fill db]
#   scripts/build-exhirom.sh [rom] --prove     also run the proof (npm run exhirom:prove, report in out/exhirom/)
# ROM: first argument, else $SOE_ROM, else out/rom.sfc (must be the clean ROM).
source "$(dirname "$0")/_common.sh"
rom="${SOE_ROM:-out/rom.sfc}"
if [ $# -gt 0 ] && [ "$1" != -- ] && [ "$1" != --prove ]; then rom="$1"; shift; fi
prove=0
if [ "${1:-}" = --prove ]; then prove=1; shift; fi
[ "${1:-}" = -- ] && shift
[ -f "$rom" ] || { echo "ROM not found: $rom (pass a path or set SOE_ROM)" >&2; exit 1; }
step "ExHiROM from $rom"; $NPM run --silent exhirom -- "$rom" "$@"
if [ "$prove" = 1 ]; then
    step "prove (snes9x core + Mesen2 if installed)"
    $NPM run --silent exhirom:prove -- --rom "$rom" \
        --movies "$HOME/Library/Application Support/Code/User/globalStorage/rbin.everscript/tas-recordings"
fi
