# WRAM allocation (Open Evermore)

Every WRAM address by name, placed by implode like a ROM resource, so tables can grow (a formula, a weapon, more than 8
alchemy effects at once) and structs can move (the Boy's record, the pointer to it). Design, the `wram` kind and the proof
of concept: [../open-evermore/wram.md](../open-evermore/wram.md). This page is the tracker: one row per step, small steps.

## Current state (v0.475.0, 2026-11-27)

- **Moving works** (v0.475.0, owner's ask: "explode the whole WRAM by meaning, region spilling, adjusted and resized enums,
  verify the game still runs when memory moves"): `wram/` is 56 part files by meaning (`frame`, `session`, `mode7`, …), cut
  in the mapping file's `memory.wram` regions with their saved blocks. A variable the reader census can rewrite moves and
  grows; a part that grows spills into the next ones; `_types.json` enums are edited and resized in the tree. Implode writes
  every census operand (3,448, 388 groups) and refuses the rest by name (`wram-pinned`, `wram-group-split`, `wram-reach`,
  `wram-save-block`, `wram-block-routine`, `wram-script-number`). Proof: 86 variables moved, five playbacks (two field
  sessions, 94k frames) in lockstep with vanilla, WRAM compared through the move ([../open-evermore/wram.md](../open-evermore/wram.md) §0.2).
- **The census** (`tools/open-evermore/wram-census.mts` → `evermore/map/us.wram-readers.json`, checked in): 736 groups the
  recording reached, 388 movable, 348 pinned (285 of them a field read on a pointer in X/Y, 28 DMA, 25 indirect modes).
  It sees only what the recording ran; immediates that hold a WRAM address (DMA sources) are not seen.
- **Names** (unchanged): per address, names.json → the compiler's MEMORY enum → the WRAM map; **251 differ** from the map
  (W1b).
- **Growing tables** (more formulas, weapons, alchemy effect slots): not started (W5, W10); their WRAM is pinned.

| # | Step | State |
|---|---|---|
| W0 | Proof of concept: one variable moved by name, playbacks in step (`tools/open-evermore/wram-poc.mts`) | ✅ `RNG_SEED_0`, intro 2m20 and attract loop (v0.456.0) |
| W1 | The `wram` kind: one file per named variable (`at`, or `in` + `offset`; `size`), read first by implode; scripts, records and rings take every WRAM name and address from it; a rename is free, a move is an error | ✅ v0.459.0: 1,216 variables (67 `in` another); G0, random 1/2 round trips, a rename builds the vanilla sha1 (`wram.test.mts`) |
| W1b | The WRAM map as the one source: the 251 differing names settled into it (or kept as the map's), the 59 inner cells as fields of their arrays and structs; `wram.mts` then generates from the map alone and drops names.json and MEMORY as name sources | 🔴 proposed (owner, 2026-11-23: "generate the wram/ folder from the wram map") |
| W2 | Move a variable whose every reader implode can rewrite: code operands from a checked-in census (`wram-census.mts`), scripts by name; resize, spill, reorder in the part files | ✅ v0.475.0: 388 groups movable, 86 variables moved in one tree, five playbacks in step (wram.md §0.2). Open: census only of what the recording reached; W2b below |
| W3 | `JOYPAD1_HELD` leaves step at frame 473: find the reader the CDL does not pin down | ✅ v0.475.0: word reads `lda $0105` (five routines) take its high byte; the library keys a word by its first byte. The census counts both bytes; the pair moves in step |
| W4 | Blocker rules: arrays as one item with their base; pointer and direct-page readers back to the immediate that makes the pointer; capped block copies (source, length); DMA sources | 🟡 v0.475.0: groups (one instruction reaching several variables moves them rigidly; an indexed reach up to 1 KiB); capped routines must cover old and new place alike. Open: pointers (285 pinned by `lda $0002,y` field reads), DMA (28), immediates |
| W2b | Scripts: a script cell written as a number pins (`wram-script-number`); flags and named values are known by vanilla address (values translated, flags not): a moved save-area variable needs flags by place too (W7, W8) | 🔴 |
| W5 | Structs and arrays as one variable each, their fields `in` them: the Boy's and Dog's records (`$4E89`, `$4F37`) and the pointer to the Boy's (`$0F3E`); the 8 alchemy effect slots (`$7E:3364`, 64 B each) | 🔴 |
| W6 | Implode generates every data word that holds a WRAM address (formulas' `learned/flags`, weapons' `owned/flags`, ring `buffer`s: names already) | 🔴 |
| W7 | Flags (the save area's named bits, scripts' `flag` names) as part of the `wram` kind | 🔴 |
| W8 | The save blocks (six DMA blocks, `$331` bytes a slot: [growable-items.md](growable-items.md)) as part of the manifest: a save from one layout does not load in another | 🔴 |
| W9 | Until then: new ids of a grown kind take `temp[]` cells from the top (wiped on every room load); one kind tried in game | 🟡 rule written (open-evermore skill), not used yet |
| W10 | Grow on that WRAM: formulas to 36+, weapons to 15+, more than 8 alchemy effect slots (tables move by their long operands; loop bounds, slot counts and id ranges as generated immediates). First: **a 9th projectile alchemy slot** (`count: 9`): its readers are known (`knowledge/wram/PROJ_ALCHEMY_SLOTS_BASE.md`): the end immediate `#$3914` in three `$91` loops, an unrolled `stz` run at `$8E:E152`, and `TARGET_SELECTION_ACTOR_0`/`_1` to move out of the way. The crash with 9 at once is not the allocator (its callers check Y = 0): trace it first | 🟡 sites known |

## Every other memory, and the format (2026-11-27)

Strategy: [../open-evermore/memory.md](../open-evermore/memory.md). Order: WRAM, SRAM, ARAM, CGRAM, VRAM; OAM only as a limit.

| # | Step | State |
|---|---|---|
| M0 | Measure what vanilla writes in VRAM, CGRAM, OAM, ARAM (intro + attract playbacks) | ✅ memory.md §2 (2026-11-27; probe: per 1 KiB / 32 B block, used and churn) |
| M1 | 🟡 v0.475.0 for WRAM's exploded tree: 56 part files by meaning (v0.474.0: 7 region files), vanilla bases in the mapping file (`memory.wram`). Still open: the knowledge side below, and the other memories. One map per memory, not one file per entry: thin `knowledge/wram/*.md` (1,344 of 1,560) folded into their map rows, repeated slots (`ENTITY_SLOT_<n>_*` 110, `WINDOW_<n>_*` 232, `cgram_queue_slot_<n>` 32) as types + one array row; the `wram` kind writes ~30 region files (ordered items, `gap`, `pin`, `count`) instead of 1,216; vanilla bases per release in `evermore/map/<release>.json`. Needs W1b first; `check-maps.mts`, `knowledge.ts`, `generate-rom-map.mts` and `soe://ram/` must read rows and array fields | 🔴 proposed |
| M2 | The probe per screen mode (field, ring menu, dialogue, shop, Mode 7 flight, title) with the PPU base registers read from the core, not the WRAM shadows; settle memory.md §3's contradictions | 🔴 |
| M3 | `sram-map.md` and `sram.json`: header, 4 slots of `$331`, checksum; generated from the save blocks once W8 lands | 🔴 |
| M4 | `aram-map.md` and `aram.json`: the driver's constants (DIR `$1F`, ESA `$D4`, EDL, table bases) found in the SPC700 code; package destinations generated by implode; a shorter echo as the first proof (more sample space, music still plays) | 🔴 |
| M5 | `cgram-map.md` and `cgram/<mode>.json`: palette roles per mode (Boy, Dog, pool, HUD, room families); role numbers generated where they are immediates | 🔴 |
| M6 | `vram-map.md` and `vram/<mode>.json` (word addresses): regions per mode; base register immediates, DMA destinations and the sprite caches' slot tables generated; a bigger sprite cache as the first growth | 🔴 |

Knowledge to fix on the way (found in W1, not fixed):

- `localizations/knowledge.ts` reads `addr: $7E:106C` as NaN: 1,306 of the 1,560 `knowledge/wram/*.md` entries are invisible to
  `entries('wram')` (Open Evermore now reads the WRAM map, `entries('ram')` / `wram-map.ts`, which parses).
- ✅ v0.459.1: the WRAM map named `$2309`-`$231C` one cell off: Gunpowder missing at `$2309`, a 23rd ingredient "Root
  Extra" at `$2314`, the 8 consumables (`$2315`-`$231C`) called two ingredients and satchel slots. Now by the ROM: ingredient
  `id` at `$22FF + id` (the name pointers `$C4:5FF3`; `$91:D800`, `$8E:8DC5`), consumable `i` at `$2315 + i` (ring items 71-78;
  `$8E:9298`, `$8E:9140`), as `knowledge/wram/ING_QTY_WAX.md` had it from the loot simulation. From `$231D` (armour) the map
  was right. Entries `ITEM_QTY_*` new, `ING_SATCHEL_SLOT_2`-`7`, `ING_QTY_ROOT_EXTRA`, `ING_QTY_PETALS` gone; `soe_ram.h`
  regenerated; `docs/disassembly/combat/alchemy-ingredients.md` (a "Mineral", no Ethanol) corrected.
- `RNG_SEED_0` is 2 bytes in the WRAM map and 8 (`$0133`-`$013A`) in its knowledge entry.
