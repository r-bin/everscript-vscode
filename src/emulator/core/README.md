# Emulator Cores

This folder now owns the SNES core sources used by the emulator panel.

Variants:
- `debugger/core/snes9x2005-wasm` — debugger-enabled fork tracked from `https://github.com/r-bin/snes9x2005-wasm.git` on branch `feature/vscode-debugger-integration`
- `debugger/core/snes9x2005-wasm-vanilla` — vanilla base tracked from `https://github.com/lrusso/snes9x2005-wasm.git`

Build both cores:

```sh
sh tools/build_snes_core.sh vanilla
sh tools/build_snes_core.sh custom
```

Extension behavior:
- Leave `everscript.snesCorePath` empty to use the bundled vanilla core.
- Point `everscript.snesCorePath` at `debugger/core/snes9x2005-wasm/snes9x_2005.js` to use the debugger-enabled core.
- Legacy settings that still point at `debugger/core/...` are remapped automatically.
