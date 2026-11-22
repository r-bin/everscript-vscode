# WRAM allocation (Open Evermore)

Every WRAM address by name, placed by implode like a ROM resource, so tables can grow (a formula, a weapon) and structs
can move (the Boy's record, the pointer to it). Design and the proof of concept: [../open-evermore/wram.md](../open-evermore/wram.md).

| # | Task | State |
|---|---|---|
| 1 | Proof of concept: one variable moved by name, playbacks in step (`tools/open-evermore/wram-poc.mts`) | ✅ `RNG_SEED_0`, intro 2m20 and attract loop (v0.456.0) |
| 2 | `JOYPAD1_HELD` leaves step at frame 473: find the reader the CDL does not pin down (capped PC or direct page) | 🟡 |
| 3 | Blocker rules: arrays as one item with their base; pointer and direct-page readers back to the immediate that makes the pointer; capped block copies (source, length); DMA sources | 🔴 |
| 4 | A `wram` kind: one file per variable or struct (size, lifetime room/save) from the knowledge entries; the Boy's and Dog's structs (`$4E89`, `$4F37`) and the pointer to the Boy's (`$0F3E`) as items | 🔴 |
| 5 | Implode generates every operand and every data word that holds a WRAM address (formulas `learned/flags`, weapons `owned/flags`, ring `buffer`s, script operands: names already) | 🔴 |
| 6 | The save block (`$2258`-`$2833`) as part of the manifest: a save from one layout does not load in another | 🔴 |
| 7 | Until then: new ids of a grown kind take `temp[]` cells from the top (wiped on every room load); one kind tried in game | 🟡 rule written (open-evermore skill), not used yet |
| 8 | Grow formulas to 36+ and weapons to 15+ on that WRAM (tables move by their long operands; loop bounds and id ranges as generated immediates) | 🔴 |
