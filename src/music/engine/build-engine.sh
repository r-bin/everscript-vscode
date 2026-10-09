#!/bin/bash
# Builds spc-engine.js (wasm embedded) from spc-engine.c and the emulator
# core's apu_blargg.c. Needs emcc (brew install emscripten). Run from anywhere.
set -e
cd "$(dirname "$0")"
CORE=../../emulator/core/snes9x2005-wasm/source

emcc -O3 -DUSE_BLARGG_APU \
    -I"$CORE" \
    -s WASM=1 -s SINGLE_FILE=1 -s MODULARIZE=1 -s EXPORT_NAME=createSpcEngine \
    -s ENVIRONMENT=web,node -s ALLOW_MEMORY_GROWTH=0 -s INITIAL_MEMORY=4194304 \
    -s EXPORTED_RUNTIME_METHODS='["HEAPU8","HEAP16"]' -s EXPORTED_FUNCTIONS='["_malloc","_free"]' \
    spc-engine.c -o spc-engine.js

ls -lh spc-engine.js
