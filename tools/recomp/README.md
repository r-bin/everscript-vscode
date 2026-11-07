# tools/recomp — seeds for the recomp

The recomp is its own repository, [SecretOfEvermoreRecomp](https://github.com/r-bin/SecretOfEvermoreRecomp)
(a sibling checkout, `../SecretOfEvermoreRecomp`): glue, docs, debugging tools. This folder turns
everything we know about the game into a rebuildable, named, commented disassembly and into seeds for
that repository, and reports what still blocks. It writes only into `out/recomp/`: the recomp repository
pulls what it needs with its own `tools/import.mts`, and builds without this checkout.

```sh
npm run recomp                       # export + rebuild; reads the recomp repo's exclusions and last generation
npm run recomp -- --no-recomp        # without reading the recomp repo (seeds without its exclusions)
npm run recomp -- --repo <dir>       # another checkout (or SOE_RECOMP)
```

Then, in the recomp repository: `node tools/import.mts --from <this checkout>` (seeds, bound C from `reconstructed-c/`,
annotations), `tools/regen.sh`, build, and commit its `recomp/bank*.cfg` and `src/bound-c/`.

## What it does

| Step | Input | Output |
|---|---|---|
| 1. Inputs | CDL library for the ROM (`<globalStorage>/rbin.everscript/cdl-library/<sha1>/`), asset regions from the ROM tab (`src/games/evermore/rom`), curated names (`functions.ts`, `tables.js`, `knowledge/{ram,rom}/*.md`, `ram-symbols`), the recomp repo's `recomp/seed-exclusions.txt` | – |
| 2. Export | the above | `out/recomp/asar/`: `main.asm`, `banks/*.asm` with **our function names** and **line comments** (callers, accesses, jump targets, curated descriptions), `ram.asm`, `structs.h`, `tables/`, `functions.json`; `asar/mesen/labels.mlb` + `asar/mesen/rom.cdl` (Mesen2); `asar/recomp/cfg/` (snesrecomp seeds, named, plus `symbol` names for the entries the recomp's last generation found, from its `src/gen/program_manifest.json`); `asar/recomp/annotations.tsv` (each instruction and routine as text, for comments in the generated C; from the user's ROM, stays in `out/`) |
| 3. Rebuild | `asar/` | `asar/build/out.sfc` (must equal the ROM byte for byte), `out.sym` (WLA symbols), `out.cdl`; `out/recomp/asar.log` |
| 4. Report | all of the above | `out/recomp/REPORT.md`, `report.json`: status per step, measures, a prioritised to-do list |

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
| the recomp repository (read only: exclusions, last generation) | step 2 | `--repo` / `SOE_RECOMP` / `../SecretOfEvermoreRecomp` |

## Reading the report

| Measure | Raise it by |
|---|---|
| ROM recorded by the CDL | playing more (rooms, menus, bosses, deaths) or scripted headless runs |
| ROM known (CDL ∪ known regions ∪ ROM-tab assets) | decoding the unknown ROM-tab regions |
| Recorded functions named / described | `re-curator` passes (`.agents/agents/re-curator.md`) |
| Instruction lines with a comment | more recorded accesses / targets, curated descriptions |
| Accessed WRAM bytes with a name | the WRAM map (`src/games/evermore/localizations/data/wram-map.md`) |
| snesrecomp interpreter-only (LLE) variants | recorded jump-table targets, more directives |
| a routine that miscompiles | a `func` / `dispatch` line in the recomp repo's `recomp/seed-exclusions.txt`, then `npm run recomp` and the recomp's import |

Building and debugging the game: the recomp repository's [docs/setup.md](https://github.com/r-bin/SecretOfEvermoreRecomp/blob/develop/docs/setup.md) and [docs/debugging.md](https://github.com/r-bin/SecretOfEvermoreRecomp/blob/develop/docs/debugging.md).

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

How they fit together: the recomp repository's [docs/headless-exploration.md](https://github.com/r-bin/SecretOfEvermoreRecomp/blob/develop/docs/headless-exploration.md).

## Comparing the build

The compare tool lives in the recomp repository (`tools/compare/`, MesenCE against the recomp), with its tests: nothing
here is needed to run it. That repository pulls from this one with its `tools/import.mts`: seeds, annotations and
the bound C (`reconstructed-c/` → its `src/bound-c/`). After changing a bound routine, import there and commit there.
