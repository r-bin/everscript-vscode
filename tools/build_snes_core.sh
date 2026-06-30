#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
VARIANT=${1:-}

if [ -z "$VARIANT" ]; then
  echo "usage: sh tools/build_snes_core.sh <vanilla|custom>" >&2
  exit 1
fi

case "$VARIANT" in
  vanilla)
    CORE_DIR="$ROOT_DIR/src/emulator/core/snes9x2005-wasm-vanilla"
    cd "$CORE_DIR"
    exec emcc -O3 \
      -s WASM=1 \
      -s EXPORTED_RUNTIME_METHODS='["cwrap"]' \
      -s ALLOW_MEMORY_GROWTH=1 \
      source/*.c \
      -o snes9x_2005.js
    ;;
  custom)
    CORE_DIR="$ROOT_DIR/src/emulator/core/snes9x2005-wasm"
    cd "$CORE_DIR"
    exec sh build.sh
    ;;
  *)
    echo "usage: sh tools/build_snes_core.sh <vanilla|custom>" >&2
    exit 1
    ;;
esac
      -o snes9x_2005.js
    ;;
  custom)
    CORE_DIR="$ROOT_DIR/src/emulator/core/snes9x2005-wasm"
    cd "$CORE_DIR"
    sh ./build.sh
    ;;
  *)
    echo "unknown core variant: $VARIANT" >&2
    exit 1
    ;;
 esac
