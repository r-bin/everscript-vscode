#!/usr/bin/env bash
# Build the recompiled game (npm run recomp): Asar export, byte-identical rebuild, snesrecomp
# host project, executable in out/recomp/SecretOfEvermore-<os>-<arch>/.
#   scripts/build-recomp.sh [rom] [-- extra args for tools/recomp/build.js, e.g. --fresh --strict]
# ROM: first argument, else the base ROM of the ROM library (npm run roms; must be the clean ROM).
source "$(dirname "$0")/_common.sh"
rom=""
if [ $# -gt 0 ] && [ "$1" != -- ]; then rom="$1"; shift; fi
[ "${1:-}" = -- ] && shift
step "recomp from ${rom:-the base ROM}"; $NPM run recomp -- ${rom:+--rom "$rom"} "$@"
