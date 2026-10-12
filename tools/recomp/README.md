# tools/recomp — the recomp build

One command that turns everything we know about the game into a rebuildable, named, commented
disassembly and a snesrecomp C project, and reports what still blocks a working recomp.

```sh
SOE_ROM="/path/to/Secret of Evermore (U) [!].smc" npm run recomp   # everything: export, rebuild, host project, game
SOE_ROM=… npm run recomp -- --fresh --strict                      # scaffold the host project again; fail on problems
SOE_ROM=… npm run recomp -- --no-build                            # generate the C but do not compile the game
SOE_ROM=… npm run recomp -- --no-recomp                           # stop after the Asar rebuild (2 s)
open "out/recomp/SecretOfEvermore-macos-arm64/play.command"       # play (Linux: play.sh, Windows: play.bat)
```

## What it does

| Step | Input | Output (in `out/recomp/`, git-ignored) |
|---|---|---|
| 1. Inputs | CDL library for the ROM (`<globalStorage>/rbin.everscript/cdl-library/<sha1>/`), asset regions from the ROM tab (`src/rom`), curated names (`functions.js`, `tables.js`, `knowledge/{ram,rom}/*.md`, `ram-symbols`) | – |
| 2. Export | the above | `asar/`: `main.asm`, `banks/*.asm` with **our function names** and **line comments** (callers, accesses, jump targets, curated descriptions), `ram.asm`, `structs.h`, `tables/`, `functions.json`; `asar/mesen/labels.mlb` + `asar/mesen/rom.cdl` (Mesen2); `asar/recomp/cfg/` (snesrecomp seeds, named) |
| 3. Rebuild | `asar/` | `asar/build/out.sfc` (must equal the ROM byte for byte), `out.sym` (WLA symbols), `out.cdl`; `asar.log` |
| 4. Host project | seeds + clean ROM + `tools/recomp/host/` | `project/`: snesrecomp's scaffold (first run or `--fresh`; clones the framework submodules), our glue laid over it, seeds in `project/recomp/`, generated C in `project/src/gen/`, build in `project/build/`; `recomp-host.log` |
| 5. Game | the build | **`SecretOfEvermore-<os>-<arch>/`**: executable, `assets/`, `mods/`, start script with the ROM path (`play.command` / `play.sh` / `play.bat`); `saves/`, `config.ini`, `keybinds.ini` survive rebuilds |
| 6. Report | all of the above | `REPORT.md`, `report.json`: status per step, measures, a prioritised to-do list |

Names become identifiers valid in Asar, C and Mesen (`Random number generator` →
`random_number_generator`; collisions get the address appended). An offset with a curated name
but no CDL label becomes a data label. Asset regions are marked as data in the Mesen CDL and
annotated in `labels.mlb`. They do not change the assembly, so the rebuild stays byte-identical.

## Prerequisites

| Tool | Needed for | Found via |
|---|---|---|
| Node ≥ 20 | everything | – |
| the clean ROM (SHA-1 `79e7738630fff5699217ef58ecc421bc8fcbcd89`) | everything | `--rom` / `SOE_ROM` |
| a CDL library for that ROM | meaningful output (without one: vectors only) | recorded in the emulator's CDL tab; `--lib` |
| Asar | step 3 | `--asar` / `ASAR` / `asar` on PATH / `../asar/asar/bin/asar` |
| snesrecomp checkout, Python 3.9+, Rust/cargo (first run builds its analyzer) | step 4 | `--snesrecomp` / `SNESRECOMP` / `../snesrecomp` |
| CMake + a C compiler (+ network on the first scaffold) | steps 4–5 | PATH |

## Reading the report

| Measure | Raise it by |
|---|---|
| ROM recorded by the CDL | playing more (rooms, menus, bosses, deaths) or scripted headless runs |
| ROM known (CDL ∪ known regions ∪ ROM-tab assets) | decoding the unknown ROM-tab regions |
| Recorded functions named / described | `re-curator` passes (`.agents/agents/re-curator.md`) |
| Instruction lines with a comment | more recorded accesses / targets, curated descriptions |
| Accessed WRAM bytes with a name | RAM knowledge entries (`src/localizations/knowledge/ram/`) |
| snesrecomp interpreter-only (LLE) variants | recorded jump-table targets, more directives |

Setting one up and feeding it these seeds: [docs/recomp/setup.md](../../docs/recomp/setup.md) and [docs/recomp/game-rtl.md](../../docs/recomp/game-rtl.md).

## Same input script on snes9x

```sh
node tools/recomp/s9x-run.js <rom> <save.srm | -> <script.txt> <outdir>
```

Runs a recomp headless script (`wait`, `press`, `poke`, `pokefor`, `forcepoke`, `dump`, `quit`)
on the extension's snes9x core and dumps WRAM, VRAM and the picture in the recomp's layout, to
check whether a glitch also happens on the reference (docs/recomp/debugging.md §5.3).

## Lockstep against snes9x

```sh
npm run recomp:lockstep -- --rom <clean rom> [--exe <recomp executable>] [--from 295 --to 479 --step 10]
```

`lockstep.js` runs the ROM in our snes9x core and in the recomp without input, lines both up on
the NMI frame counter `$7E0100`, copies snes9x's RNG state into the recomp (the reset seeds it
from PPU timing), and prints how many WRAM bytes differ at each counter value, plus the first
divergence. Today: identical through counter 305, timing drift from 315.

Measured on 2026-10-12 with the current library: byte-identical rebuild; 9.3 % of the ROM
recorded, 94.0 % known; 38 of 403 recorded functions named; 47.2 % of instruction lines
commented; snesrecomp: 411 roots → 1044 variants (692 native, 352 interpreter-only), ~25 s.
