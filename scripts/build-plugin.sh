#!/usr/bin/env bash
# Build the extension: compile the TypeScript domains and package out/everscript-<version>.vsix.
#   scripts/build-plugin.sh            package only
#   scripts/build-plugin.sh --install  package and install into VS Code (npm run deploy)
#   scripts/build-plugin.sh --cores    also rebuild both snes9x wasm cores first (needs emsdk)
source "$(dirname "$0")/_common.sh"
install=0 cores=0
for a in "$@"; do case "$a" in
  --install) install=1 ;; --cores) cores=1 ;;
  *) echo "unknown option $a" >&2; exit 2 ;; esac; done
[ $cores = 1 ] && { step "build snes9x cores"; $NPM run build:cores; }
step "compile the TypeScript"; $NPM run build:ts
if [ $install = 1 ]; then step "package and install"; $NPM run deploy
else step "package"; $NPM run package; fi
