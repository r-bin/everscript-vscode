# WRAM allocation (Open Evermore)

Every WRAM address by name, placed by implode like a ROM resource, so tables can grow (a formula, a weapon, more than 8
alchemy effects at once) and structs can move (the Boy's record, the pointer to it). Design, the `wram` kind and the proof
of concept: [../open-evermore/wram.md](../open-evermore/wram.md). This page is the tracker: one row per step, small steps.

| # | Step | State |
|---|---|---|
| W0 | Proof of concept: one variable moved by name, playbacks in step (`tools/open-evermore/wram-poc.mts`) | ✅ `RNG_SEED_0`, intro 2m20 and attract loop (v0.456.0) |
| W1 | The `wram` kind: one file per named variable (`at`, or `in` + `offset`; `size`), read first by implode; scripts, records and rings take every WRAM name and address from it; a rename is free, a move is an error | ✅ v0.459.0: 1,216 variables (67 `in` another); G0, random 1/2 round trips, a rename builds the vanilla sha1 (`wram.test.mts`) |
| W2 | Move a variable whose every reader implode can rewrite: code operands (the PoC's rule) and script operands (save/temp area offsets, already names). Implode needs the reader sites without the user's CDL library: explode records them (generated, in `_base/`, by routine name + offset). First: `RNG_SEED_0` (the PoC's), then a script-only save cell | 🔴 |
| W3 | `JOYPAD1_HELD` leaves step at frame 473: find the reader the CDL does not pin down (capped PC or direct page) | 🟡 |
| W4 | Blocker rules: arrays as one item with their base; pointer and direct-page readers back to the immediate that makes the pointer; capped block copies (source, length); DMA sources | 🔴 |
| W5 | Structs and arrays as one variable each, their fields `in` them: the Boy's and Dog's records (`$4E89`, `$4F37`) and the pointer to the Boy's (`$0F3E`); the 8 alchemy effect slots (`$7E:3364`, 64 B each) | 🔴 |
| W6 | Implode generates every data word that holds a WRAM address (formulas' `learned/flags`, weapons' `owned/flags`, ring `buffer`s: names already) | 🔴 |
| W7 | Flags (the save area's named bits, scripts' `flag` names) as part of the `wram` kind | 🔴 |
| W8 | The save block (`$2258`-`$2833`) as part of the manifest: a save from one layout does not load in another | 🔴 |
| W9 | Until then: new ids of a grown kind take `temp[]` cells from the top (wiped on every room load); one kind tried in game | 🟡 rule written (open-evermore skill), not used yet |
| W10 | Grow on that WRAM: formulas to 36+, weapons to 15+, more than 8 alchemy effect slots (tables move by their long operands; loop bounds, slot counts and id ranges as generated immediates) | 🔴 |

Knowledge to fix on the way (found in W1, not fixed):

- `localizations/knowledge.ts` reads `addr: $7E:106C` as NaN: 1,306 of the 1,560 `knowledge/wram/*.md` entries are invisible to
  `entries('wram')` (Open Evermore now reads the WRAM map, `entries('ram')` / `wram-map.ts`, which parses).
- The WRAM map (`localizations/data/wram-map.md`) names the save area's ingredient and armour counts one cell off against
  names.json from `$7E:2309` (`ING_QTY_GREASE` where names.json and the alchemy codec's `$22FF + id` have GUNPOWDER) to `$2323`;
  the `wram` kind takes names.json's names first.
- `RNG_SEED_0` is 2 bytes in the WRAM map and 8 (`$0133`-`$013A`) in its knowledge entry.
