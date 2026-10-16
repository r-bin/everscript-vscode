#!/usr/bin/env bash
# Build the table hack (npm run table-hack) into out/table-hack/soe-tables.sfc: Evermore's content tables moved into
# the 4th MB, nothing else changed.
#   scripts/build-table-hack.sh [rom] [-- extra args for tools/table-hack/build.js, e.g. --tables map_table --ips x.ips]
#   scripts/build-table-hack.sh [rom] --prove     also run the proof (npm run table-hack:prove, out/table-hack/REPORT.md)
# ROM: first argument, else the base ROM of the ROM library (npm run roms; must be the clean ROM).
source "$(dirname "$0")/_common.sh"
rom=""
if [ $# -gt 0 ] && [ "$1" != -- ] && [ "$1" != --prove ]; then rom="$1"; shift; fi
prove=0
if [ "${1:-}" = --prove ]; then prove=1; shift; fi
[ "${1:-}" = -- ] && shift
step "table hack from ${rom:-the base ROM}"; $NPM run --silent table-hack -- ${rom:+--rom "$rom"} "$@"
if [ "$prove" = 1 ]; then
    step "prove (sample playbacks, snes9x core)"
    $NPM run --silent table-hack:prove -- ${rom:+--rom "$rom"}
fi
