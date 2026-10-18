#!/bin/sh
# Rebuild the ROM and its CDL from this folder:  ASAR=/path/to/asar ./build.sh
# Output: build/out.sfc, build/out.sym (WLA labels), build/out.cdl
set -e
cd "$(dirname "$0")"
ASAR="${ASAR:-asar}"
mkdir -p build
rm -f build/out.sfc
"$ASAR" --fix-checksum=off --no-title-check --symbols=wla --symbols-path=build/out.sym main.asm build/out.sfc
node build-cdl.js build/out.sym build/out.sfc build/out.cdl
