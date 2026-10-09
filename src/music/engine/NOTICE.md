# spc-engine.js: licence notice

`spc-engine.js` is compiled from `spc-engine.c` and the emulator core's
`src/emulator/core/snes9x2005-wasm/source/apu_blargg.c`. That file is the SPC700/S-DSP
emulation by Shay Green (blargg), under the GNU Lesser General Public License 2.1 or later,
inside the snes9x2005 core whose terms are in `copyright` (shipped next to this file, as with
the core's own build).

The complete source is in this repository: `spc-engine.c`, `build-engine.sh` and the core's
`apu_blargg.c` (the core is a git submodule, https://github.com/r-bin/snes9x2005-wasm). Rebuild with
`npm run build:music-engine`.
