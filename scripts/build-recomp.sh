#!/usr/bin/env bash
# Build the recompiled game (npm run recomp): Asar export, byte-identical rebuild, snesrecomp
# host project, executable in out/recomp/SecretOfEvermore-<os>-<arch>/.
#   scripts/build-recomp.sh [rom] [-- extra args for tools/recomp/build.js, e.g. --fresh --strict]
# ROM: first argument, else $SOE_ROM, else out/rom.sfc (must be the clean ROM).
source "$(dirname "$0")/_common.sh"
rom="${SOE_ROM:-out/rom.sfc}"
if [ $# -gt 0 ] && [ "$1" != -- ]; then rom="$1"; shift; fi
[ "${1:-}" = -- ] && shift
[ -f "$rom" ] || { echo "ROM not found: $rom (pass a path or set SOE_ROM)" >&2; exit 1; }
step "recomp from $rom"; $NPM run recomp -- --rom "$rom" "$@"
