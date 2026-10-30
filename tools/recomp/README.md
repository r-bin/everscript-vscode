# tools/recomp — seeds for the recomp

The recomp is its own repository, [SecrefOfEvermoreRecomp](https://github.com/r-bin/SecrefOfEvermoreRecomp)
(a sibling checkout, `../SecrefOfEvermoreRecomp`): glue, docs, debugging tools. This folder turns
everything we know about the game into a rebuildable, named, commented disassembly and into that
repository's seeds, then lets it regenerate and build, and reports what still blocks.

```sh
npm run recomp                       # everything: export, rebuild, seeds into the recomp repo, its regen + build
npm run recomp -- --no-build         # stop after writing the seeds (recomp/bank*.cfg there)
npm run recomp -- --no-recomp        # stop after the Asar rebuild (2 s); the recomp repo is not touched
npm run recomp -- --repo <dir>       # another checkout (or SOE_RECOMP)
```

Then commit the changed `recomp/bank*.cfg` in the recomp repository. Play its
`build/SecretOfEvermoreSNESRecomp`.

## What it does

| Step | Input | Output |
|---|---|---|
| 1. Inputs | CDL library for the ROM (`<globalStorage>/rbin.everscript/cdl-library/<sha1>/`), asset regions from the ROM tab (`src/games/evermore/rom`), curated names (`functions.ts`, `tables.js`, `knowledge/{ram,rom}/*.md`, `ram-symbols`), the recomp repo's `recomp/seed-exclusions.txt` | – |
| 2. Export | the above | `out/recomp/asar/`: `main.asm`, `banks/*.asm` with **our function names** and **line comments** (callers, accesses, jump targets, curated descriptions), `ram.asm`, `structs.h`, `tables/`, `functions.json`; `asar/mesen/labels.mlb` + `asar/mesen/rom.cdl` (Mesen2); `asar/recomp/cfg/` (snesrecomp seeds, named) |
| 3. Rebuild | `asar/` | `asar/build/out.sfc` (must equal the ROM byte for byte), `out.sym` (WLA symbols), `out.cdl`; `out/recomp/asar.log` |
| 4. Seeds | `asar/recomp/cfg/` | the recomp repo's `recomp/bank8x..9x.cfg` replaced, one data-region block in its `recomp/bank00.cfg` (`repo.mts`) |
| 5. Game | the recomp repo | its `tools/regen.sh` and CMake build → `build/SecretOfEvermoreSNESRecomp` there; log in `out/recomp/recomp-host.log` |
| 6. Report | all of the above | `out/recomp/REPORT.md`, `report.json`: status per step, measures, a prioritised to-do list |

Names become identifiers valid in Asar, C and Mesen (`Random number generator` →
`random_number_generator`; collisions get the address appended). An offset with a curated name
but no CDL label becomes a data label. Asset regions are marked as data in the Mesen CDL and
annotated in `labels.mlb`. They do not change the assembly, so the rebuild stays byte-identical.

## Prerequisites

| Tool | Needed for | Found via |
|---|---|---|
| Node ≥ 20 | everything | – |
| the clean ROM (SHA-1 `79e7738630fff5699217ef58ecc421bc8fcbcd89`) | everything | `--rom`, else the ROM library's base ROM |
| a CDL library for that ROM | meaningful output (without one: vectors only) | recorded in the emulator's CDL tab; `--lib` |
| Asar | step 3 | `--asar` / `ASAR` / `asar` on PATH / `../asar/asar/bin/asar` |
| the recomp repository with its submodules | steps 4–5 | `--repo` / `SOE_RECOMP` / `../SecrefOfEvermoreRecomp` |
| Python 3.9+, Rust/cargo, CMake, a C compiler | step 5 | PATH |

## Reading the report

| Measure | Raise it by |
|---|---|
| ROM recorded by the CDL | playing more (rooms, menus, bosses, deaths) or scripted headless runs |
| ROM known (CDL ∪ known regions ∪ ROM-tab assets) | decoding the unknown ROM-tab regions |
| Recorded functions named / described | `re-curator` passes (`.agents/agents/re-curator.md`) |
| Instruction lines with a comment | more recorded accesses / targets, curated descriptions |
| Accessed WRAM bytes with a name | RAM knowledge entries (`src/games/evermore/localizations/knowledge/ram/`) |
| snesrecomp interpreter-only (LLE) variants | recorded jump-table targets, more directives |
| a routine that miscompiles | a `func` / `dispatch` line in the recomp repo's `recomp/seed-exclusions.txt`, then `npm run recomp` |

Building and debugging the game: the recomp repository's [docs/setup.md](https://github.com/r-bin/SecrefOfEvermoreRecomp/blob/develop/docs/setup.md) and [docs/debugging.md](https://github.com/r-bin/SecrefOfEvermoreRecomp/blob/develop/docs/debugging.md).

## Same input script on snes9x

```sh
node tools/recomp/s9x-run.js <rom> <save.srm | -> <script.txt> <outdir>
```

Runs a recomp headless script (`wait`, `press`, `poke`, `pokefor`, `forcepoke`, `dump`, `quit`)
on the extension's snes9x core and dumps WRAM, VRAM and the picture in the recomp's layout, to
check whether a glitch also happens on the reference (the recomp repository's docs/debugging.md §5.3).

## Headless exploration helpers

```sh
node tools/recomp/room-nav.js <rom> <room hex> [--script]     # triggers + destinations, enemy spawns, script lines
```

How they fit together: the recomp repository's [docs/headless-exploration.md](https://github.com/r-bin/SecrefOfEvermoreRecomp/blob/develop/docs/headless-exploration.md).

## Lockstep against snes9x

```sh
npm run recomp:lockstep [-- --rom <clean rom>]            # = npm run compare -- recomp=
npm run compare -- recomp:<exe>=<rom> recomp:<other exe>=<rom>   # e.g. with hooks against without
```

`tools/compare` (its README) runs the ROM in our snes9x core and in the recomp without input, lines
both up on the NMI frame counter `$7E0100`, copies snes9x's RNG state into the recomp (the reset
seeds it from PPU timing), hashes WRAM + VRAM every 60 counts and reports the first checkpoint
that differs, with the bytes and snes9x's writers. The recomp hashes through its glue
(`SOE_COMPARE_*` in the recomp repo's `src/game_rtl.c`).
Today: identical through counter 300, different at 360.

Measured on 2026-10-30 with the full-play library: byte-identical rebuild; 90.3 % of the ROM
recorded, 98.5 % known; 347 of 987 recorded functions named; 49.2 % of instruction lines
commented; on the recomp repo's framework pin: 3916 roots, 4871 native variants, 759 interpreted.
