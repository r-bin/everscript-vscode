# WRAM allocation (Open Evermore)

Every WRAM address by name, placed by implode like a ROM resource, so tables can grow (a formula, a weapon, more than 8
alchemy effects at once) and structs can move (the Boy's record, the pointer to it). Design, the `wram` kind and the proof
of concept: [../open-evermore/wram.md](../open-evermore/wram.md). This page is the tracker: one row per step, small steps.

## Current state (v0.459.1, 2026-11-23)

- **The `wram` kind exists** (`tools/open-evermore/evermore/codecs/wram.mts`, folder `wram/`): 1,216 variables, 67 of them
  `in` another. Implode reads it first; scripts, equipment and alchemy records and rings take every WRAM name and address
  from it. A rename builds the vanilla ROM; a move is an error (`wram-moved`). Nothing is generated into the ROM yet.
- **Where its names come from**: per address, names.json → the compiler's MEMORY enum → the WRAM map
  (`localizations/data/wram-map.md`, 1,148 entries); sizes and nesting from the WRAM map. Against the WRAM map: 885 addresses
  have the same name, **251 a different one** (`INPUT_P1` / `JOYPAD1_HELD`), **59 script-named cells lie inside a map entry**
  with no name of their own (the formulas' levels in `FORMULA_COMBAT_POWER_ARRAY`), 1 map entry has no script name.
- **The WRAM map's save area is right again** (v0.459.1): `$2309`-`$231C` were one cell off (below). Open Evermore's files
  did not change: names.json's names already won there.
- **Moving**: only the proof of concept (`wram-poc.mts`, W0) has moved a variable; the kind cannot yet (W2).
- **Growing** (more formulas, weapons, alchemy effect slots): not started (W5, W10).

| # | Step | State |
|---|---|---|
| W0 | Proof of concept: one variable moved by name, playbacks in step (`tools/open-evermore/wram-poc.mts`) | ✅ `RNG_SEED_0`, intro 2m20 and attract loop (v0.456.0) |
| W1 | The `wram` kind: one file per named variable (`at`, or `in` + `offset`; `size`), read first by implode; scripts, records and rings take every WRAM name and address from it; a rename is free, a move is an error | ✅ v0.459.0: 1,216 variables (67 `in` another); G0, random 1/2 round trips, a rename builds the vanilla sha1 (`wram.test.mts`) |
| W1b | The WRAM map as the one source: the 251 differing names settled into it (or kept as the map's), the 59 inner cells as fields of their arrays and structs; `wram.mts` then generates from the map alone and drops names.json and MEMORY as name sources | 🔴 proposed (owner, 2026-11-23: "generate the wram/ folder from the wram map") |
| W2 | Move a variable whose every reader implode can rewrite: code operands (the PoC's rule) and script operands (save/temp area offsets, already names). Implode needs the reader sites without the user's CDL library: explode records them (generated, in `_base/`, by routine name + offset). First: `RNG_SEED_0` (the PoC's), then a script-only save cell | 🔴 |
| W3 | `JOYPAD1_HELD` leaves step at frame 473: find the reader the CDL does not pin down (capped PC or direct page) | 🟡 |
| W4 | Blocker rules: arrays as one item with their base; pointer and direct-page readers back to the immediate that makes the pointer; capped block copies (source, length); DMA sources | 🔴 |
| W5 | Structs and arrays as one variable each, their fields `in` them: the Boy's and Dog's records (`$4E89`, `$4F37`) and the pointer to the Boy's (`$0F3E`); the 8 alchemy effect slots (`$7E:3364`, 64 B each) | 🔴 |
| W6 | Implode generates every data word that holds a WRAM address (formulas' `learned/flags`, weapons' `owned/flags`, ring `buffer`s: names already) | 🔴 |
| W7 | Flags (the save area's named bits, scripts' `flag` names) as part of the `wram` kind | 🔴 |
| W8 | The save blocks (six DMA blocks, `$331` bytes a slot: [growable-items.md](growable-items.md)) as part of the manifest: a save from one layout does not load in another | 🔴 |
| W9 | Until then: new ids of a grown kind take `temp[]` cells from the top (wiped on every room load); one kind tried in game | 🟡 rule written (open-evermore skill), not used yet |
| W10 | Grow on that WRAM: formulas to 36+, weapons to 15+, more than 8 alchemy effect slots (tables move by their long operands; loop bounds, slot counts and id ranges as generated immediates) | 🔴 |

## Every other memory, and the format (2026-11-27)

Strategy: [../open-evermore/memory.md](../open-evermore/memory.md). Order: WRAM, SRAM, ARAM, CGRAM, VRAM; OAM only as a limit.

| # | Step | State |
|---|---|---|
| M0 | Measure what vanilla writes in VRAM, CGRAM, OAM, ARAM (intro + attract playbacks) | ✅ memory.md §2 (2026-11-27; probe: per 1 KiB / 32 B block, used and churn) |
| M1 | One map per memory, not one file per entry: thin `knowledge/wram/*.md` (1,344 of 1,560) folded into their map rows, repeated slots (`ENTITY_SLOT_<n>_*` 110, `WINDOW_<n>_*` 232, `cgram_queue_slot_<n>` 32) as types + one array row; the `wram` kind writes ~30 region files (ordered items, `gap`, `pin`, `count`) instead of 1,216; vanilla bases per release in `evermore/map/<release>.json`. Needs W1b first; `check-maps.mts`, `knowledge.ts`, `generate-rom-map.mts` and `soe://ram/` must read rows and array fields | 🔴 proposed |
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
