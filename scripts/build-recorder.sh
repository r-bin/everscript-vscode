#!/usr/bin/env bash
# Build the SNES CDL Recorder: compile the TypeScript it uses and package out/snes-cdl-recorder-<version>.vsix
# (only the files it uses, tools/recorder/package-files.js).
#   scripts/build-recorder.sh            package only
#   scripts/build-recorder.sh --install  package and install it into VS Code
source "$(dirname "$0")/_common.sh"
install=0
for a in "$@"; do case "$a" in
  --install) install=1 ;;
  *) echo "unknown option $a" >&2; exit 2 ;; esac; done
step "package the recorder"; $NPM run build:recorder
if [ $install = 1 ]; then
  step "install"; v=$(node -p "require('./package.json').version")
  code --install-extension "out/snes-cdl-recorder-$v.vsix" --force
fi
