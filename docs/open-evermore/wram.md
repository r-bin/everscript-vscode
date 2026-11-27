# Open Evermore: WRAM by name

Status: **the `wram` kind (v0.459.0)**, written as region files since v0.474.0: every other kind names WRAM through it.
Moving is the next step. **Proof of concept (v0.456.0)**: one variable moved by name, the stored playbacks in step. Tracker:
[../todo/wram-allocation.md](../todo/wram-allocation.md) (W0-W10). Back to [README.md](README.md). Labels as there.
The other memories (VRAM, CGRAM, OAM, ARAM, SRAM), each to be written the same way: [memory.md](memory.md).

The ROM kinds place resources anywhere because every reference to them is generated. WRAM is the same problem one level
down: the files already name WRAM (`write_word ENEMY_SPAWNER_QUANTITY, 1` in scripts, a ring's `buffer`, a formula's
`learned/flags`, a weapon's `owned/flags`), but the game reaches each variable through fixed operands. Growing a table
whose per-id state lives in WRAM (a 36th formula, a 15th weapon) needs WRAM that is not there: the formulas' experience,
level and cast words are 35 each, back to back; the weapon skill words run into the Dog's.

## 0. The `wram` kind *(W1, v0.459.0; region files v0.474.0)*

`wram/<region>.json`, one file per region, and `wram/_types.json`. There are 1,216 variables in 7 files (until
v0.473 there was one file per variable), and `_enum.json` lists no ids. A region file is an ordered list. Each item's
address follows from the region's start, the order and the sizes, as in a C struct (shortened from `room.json`):

```json
{ "format": "open-evermore/memory", "version": 1, "space": "wram", "region": "room",
  "items": [
    { "name": "ANIM_ALCHEMY_SLOTS_BASE", "type": "AnimAlchemySlot", "count": 8 },
    { "name": "PROJ_ALCHEMY_SLOTS_BASE", "type": "ProjAlchemySlot", "count": 8 },
    { "name": "PROJ_ALCHEMY_ALIGN_PAD", "type": "u8", "count": 2 },
    { "gap": 6 },
    { "name": "JOYPAD_CHORD_HISTORY", "type": "u16", "count": 128, "cells": [{ "name": "ATTACK_SLOT_128", "offset": 0 }] },
    { "name": "DOG_READ" }
  ] }
```

- **`type` and `count`** give the size: the type's size × count. Types are `u8`/`i8`/`u16`/`i16`/`u24`/`u32`, or a
  struct, typedef or sized enum of `_types.json`. `_types.json` is the vanilla `localizations/data/types.json`,
  exploded; edit or extend it there. `size` beside a type only where the WRAM map's size is not the type's.
- **`cells`** are names inside an item: a struct's field, an array's cell, a second name on the same byte. Each has an
  `offset` and maybe a `size`, and moves with its item.
- **An item with no type or size** is a cell whose width each access decides. It takes no room; the `gap` after it does.
- **`gap`** is bytes nothing is named for.
- **The regions come from the mapping file** (`memory.wram` in `evermore/map/<release>.json`, [mapping.md](mapping.md)):
  each region's span, and how the engine reaches it. That is what forces a variable into its region:

  | Region | Span | Reach |
  |---|---|---|
  | `direct_page` | `$0000`-`$00FF` | 1-byte direct-page operands (D = 0) |
  | `low` | `$0100`-`$1FFF` | 16-bit absolute operands from banks `$80`-`$BF` (WRAM's low mirror) |
  | `system` | `$2000`-`$2257` | data bank `$7E`, or long |
  | `save` | `$2258`-`$2833` | data bank `$7E` (the save blocks and the script save area) |
  | `temp` | `$2834`-`$28FB` | data bank `$7E`; temp[] (`TEMP_COMPILER_ARENA`, 200 bytes) |
  | `room` | `$28FC`-`$FFFF` | data bank `$7E`, or long |
  | `bank_7f` | `$7F:0000`-`$FFFF` | long |

  A region holds no address of its own, so a language release with other bases only changes its mapping file.

Implode reads the kind first (`KINDS[0]`) and hands its addresses to the later kinds: script operands
(`write_word ENEMY_SPAWNER_QUANTITY, 1`), records' `wram` fields (`LEVEL_LOW_CURE`) and rings' buffers. A name no
region has is an error where it is used. A rename (in its region file and at its uses) builds the vanilla sha1, and the
round trip keeps the new name (the kind's `symbols` give each name's address).

**Moving and resizing are refused** until implode rewrites the code that reaches a variable (W2):

- `wram-resized`: a variable at its vanilla address with another size.
- `wram-moved`: the variables that left their place, one finding per region, the first three by name.
- `wram-region-full`: an item that ends past its region.

The owner's two checks show what the format lets a user say, and what is still missing (2026-11-27,
`wram.test.mts`):

- **temp[] is bigger than it needs to be.** `"count": 100` and a `{ "gap": 100 }` say it in two lines. Implode refuses
  it as resized: the compiler's temp[] size is not generated yet.
- **A 9th projectile alchemy slot** (the game crashes with 9 at once: 8 from the player, 1 from a boss). `"count": 9`
  on `PROJ_ALCHEMY_SLOTS_BASE` shifts the 109 variables after it by 118 bytes, and the last ones would leave bank
  `$7E`. Implode names the resize, the moves and the overflow. What growth needs (three loop-end immediates, an
  unrolled clear, two target words to move) is written in `knowledge/wram/PROJ_ALCHEMY_SLOTS_BASE.md`. It is tracked
  as W10.

**Names.** One per address, the ones scripts already read cells by (script-model/names.ts `displayNames`: names.json,
then the compiler's MEMORY enum, then the WRAM map), plus the WRAM map's `$7F` entries; sizes from the WRAM map
(`localizations/data/wram-map.md`) for a variable that starts where its entry starts; a variable inside a sized one is
`in` it. Where a script names an array's or struct's first cell otherwise, the whole keeps the WRAM map's name and the
cell is `in` it at offset 0 (`LEVEL_HIGH_ACID_RAIN` in `FORMULA_COMBAT_POWER_ARRAY`, with the other 34 formulas' cells);
two names that differ only in case are one (`PALETTE_BG_4`). A name the sources give two addresses is left out (both stay `$7E:xxxx`). The scripts' files did not change; the
records' WRAM fields read better (Cure's cells were `FORMULA_XP_ACID_RAIN+12`, now `LEVEL_LOW_CURE`): before, the tools
read the knowledge `wram` space, whose `$7E:xxxx` addresses do not parse (254 of 1,560 entries seen; tracker, knowledge to fix).
The sources still differ at 251 addresses; making the WRAM map the one source is W1b (tracker, current state).

## 1. Until WRAM can be allocated: `temp[]` as a placeholder

The compiler's `temp[]` (`COMPILER_TEMP`, `$7E:2834`-`$28FB`, 100 words, `REGION_ROOM_SCRATCH`) is the one block meant
for anyone's use. A kind that grows past the WRAM its ids have may give the new ids cells of `temp[]` as a placeholder,
named in the kind's file (`"experience": "temp[90]"`), taken from the top down: vanilla's room scripts use low cells (`temp[1]`, `temp[3]`, `temp[8]` seen), and a
room's own scripts keep theirs. The price, said in the file: `temp[]` is wiped on every room load and not saved, so the state
lasts one room. Good enough to try a new formula or weapon; not for a release. The real fix is §3.

## 2. The proof of concept: `tools/open-evermore/wram-poc.mts`

```
node tools/open-evermore/wram-poc.mts --scan                       every WRAM entry the recorded play reached, by blockers
node tools/open-evermore/wram-poc.mts RNG_SEED_0                   its references, what blocks a move
node tools/open-evermore/wram-poc.mts RNG_SEED_0 --to RING_DEBUG_ITEMS [--movie <file.evsmv>] [--frames n]
```

**References.** From the vanilla CDL library (`cdl-recorder` skill): `xrefs.bin` lists each PC with every WRAM byte it
touched, how wide, and whether through a pointer (PCs are bus addresses, `$8F:A198`); capped PCs (128+ addresses) keep
only a lowest-to-highest range; `script-xrefs.bin` the script instructions. Plus a static scan of every recorded
instruction head for an operand inside the variable.

**What can move.** An instruction whose operand is the variable: absolute or long, plain or indexed, base inside it,
and touching nothing outside it. The rewrite keeps the opcode, length and cycle count (all WRAM is one speed), so the
build can stay in lockstep. **What blocks**: direct page, indirect, a pointer, a base outside the variable (an array or
block holding it), an instruction that also touches bytes past it, DMA, a script. **Unknown**, not rewritten: capped PCs
whose range covers it (a range does not say they touch it) and static operands never seen touching it (a 16-bit operand
is WRAM only when the data bank mirrors low RAM; with DB `$C4` it reads ROM).

**The check.** Vanilla and the build play a stored playback in two snes9x cores; after every frame WRAM must be equal
through the move (vanilla's old place = the build's new place, and back) and so must the PC.

**Results** (2026-11-22; target: the debug ring's buffer `$0F5A`-`$0F7F`, which nothing in vanilla touches):

| Variable | Rewritten | Playback | Result |
|---|---|---|---|
| `RNG_SEED_0` (`$0133`, 8 B) | 27 instructions | intro 2m20 (8,414 frames), attract loop (6,224) | **in step**, every frame |
| `CONTROL_CONFIGURATION` (`$0B21`, 2 B) | 5 | intro 2m20 | in step (its screen never runs: proves only boot) |
| `JOYPAD1_HELD` (`$0104`, 2 B) | 73 | intro 2m20 | **leaves step at frame 473** (`$0004` differs): a reader the CDL does not pin down (a capped PC or a direct-page access with D ≠ 0); open |

`--scan`: of 191 entries the play reached, 13 have no blocker; most have one to a few (arrays reached through another
base, pointers, scripts). The 42 capped PCs (generic copy and pointer routines) cover nearly every variable.

## 3. Toward allocated WRAM *(proposal; tracker: [../todo/wram-allocation.md](../todo/wram-allocation.md))*

The `wram` kind (§0) with lifetimes (room/save), and implode places its variables like ROM items: saved state inside the six saved blocks (`$0ABA`, `$2F52`, `$2258`, `$22FF`, `$2361`, `$2513`: [../todo/growable-items.md](../todo/growable-items.md); `$2258`-`$2833` is not saved as a whole), room state
anywhere, the Boy's struct and the pointer to it (`$0F3E`) as one item. What implode then generates, per variable: every
operand the CDL ties to it, the data that holds its address (the formulas' `learned/flags`, a weapon's `owned/flags`, a
ring's `buffer`: already names in their files), script operands (already names). Before that holds, every blocker class
above needs a rule: arrays move as one item with their base; pointer and direct-page readers need their pointer's
source found (often an immediate: `lda #$0F5A`); capped routines are block copies whose source and length are
immediates or tables; DMA sources are immediates. A save written by one layout does not load in another: the save
block's layout must be part of the manifest.
