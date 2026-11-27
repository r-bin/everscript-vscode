# Open Evermore: WRAM by name

Status: **the `wram` kind (v0.459.0)**, one file per part of WRAM by meaning since v0.475.0, and **moving** since
v0.475.0: a variable the reader census can rewrite moves, grows and spills, proved in lockstep with vanilla (§0.2).
Every other kind names WRAM through it. Tracker: [../todo/wram-allocation.md](../todo/wram-allocation.md) (W0-W10).
Back to [README.md](README.md). Labels as there. The other memories (VRAM, CGRAM, OAM, ARAM, SRAM), each to be written
the same way: [memory.md](memory.md).

The ROM kinds place resources anywhere because every reference to them is generated. WRAM is the same problem one level
down: the files already name WRAM (`write_word ENEMY_SPAWNER_QUANTITY, 1` in scripts, a ring's `buffer`, a formula's
`learned/flags`, a weapon's `owned/flags`), but the game reaches each variable through fixed operands. Growing a table
whose per-id state lives in WRAM (a 36th formula, a 15th weapon) needs WRAM that is not there.

## 0. The `wram` kind *(W1, v0.459.0; parts by meaning and moving v0.475.0)*

`wram/<part>.json`, one file per part (56: `frame`, `palettes`, `windows`, `party`, `session`, `mode7`, `entities`, …; no part shares a name with another kind's file, `metatiles.json` or `font.json`: tests and tools find those by name),
and `wram/_types.json`. A part file is an ordered list; each item's address follows from where the part starts, the
order and the sizes, as in a C struct (shortened; the last items are from other parts, to show each form):

```json
{ "format": "open-evermore/memory", "version": 1, "space": "wram", "region": "low", "part": "session",
  "what": "controls, save menu, font, stamina, audio volume, shop and dialogue state",
  "items": [
    { "name": "HUD_DIRTY_UPDATE_FLAGS", "type": "u16" },
    { "name": "CHOICE_PROMPT_STATE", "type": "ChoiceBoxState" },
    { "name": "ACTIVE_PLAYER_CHAR_ALIGN_PAD", "type": "u8", "count": 2 },
    { "name": "JOYPAD1_HELD", "type": "JoypadButtons", "cells": [{ "name": "INPUT_P1", "offset": 0 }] },
    { "gap": 6 },
    { "name": "DOG_READ" }
  ] }
```

- **`type` and `count`** give the size: the type's size × count. Types are `u8`/`i8`/`u16`/`i16`/`u24`/`u32`, or a
  struct, typedef or enum of `_types.json`. `size` beside a type only where the WRAM map's size is not the type's.
- **`cells`** are names inside an item (a field, an array's cell, a second name on a byte): an `offset`, maybe a `size`.
- **An item with no type or size** is a cell whose width each access decides; it takes no room.
- **`gap`** is bytes nothing is named for. What lies after a part's last item, up to where the next part starts, is free
  and not written.
- **`_types.json`** is the vanilla `localizations/data/types.json`, exploded, and the tree's to change: an enum's values
  renamed or added, its `size` changed (every item of that type is resized with it), a struct's size. Implode checks each
  enum (values fit its size, each name once). The ROM holds no type: the round trip carries the tree's.
- **Regions and parts come from the mapping file** (`memory.wram` in `evermore/map/<release>.json`, [mapping.md](mapping.md)).
  A region is where the engine's reach changes, and that is what forces a variable's place:

  | Region | Span | Reach | Parts |
  |---|---|---|---|
  | `direct_page` | `$0000`-`$00FF` | 1-byte direct-page operands (D = 0) | 1 |
  | `low` | `$0100`-`$1FFF` | 16-bit absolute operands from banks `$80`-`$BF` (WRAM's low mirror); saved block `$0ABA`-`$0B1E` | 25 |
  | `system` | `$2000`-`$2257` | data bank `$7E`, or long | 4 |
  | `save` | `$2258`-`$2833` | data bank `$7E`; saved blocks `$2258`, `$22FF`, `$2361`, `$2513` | 4 |
  | `temp` | `$2834`-`$28FB` | data bank `$7E`; temp[] (`TEMP_COMPILER_ARENA`, 200 bytes) | 1 |
  | `room` | `$28FC`-`$FFFF` | data bank `$7E`, or long; saved block `$2F52`-`$2FF3` | 13 |
  | `bank_7f` | `$7F:0000`-`$FFFF` | long, or the data bank `$7F` | 8 |

  A part has a vanilla start in the mapping file and a line saying what it holds. A cut never splits an item: an item
  belongs to the part where it starts, and the next part starts after it.

Implode reads the kind first (`KINDS[0]`) and hands its addresses to the later kinds: script operands
(`write_word ENEMY_SPAWNER_QUANTITY, 1`; a cell's named values are looked up at its vanilla place), records' `wram`
fields (`LEVEL_LOW_CURE`) and rings' buffers. A name no part has is an error where it is used. A rename (in its part file
and at its uses) builds the vanilla sha1.

### 0.1 Spilling

A part starts at its vanilla start or, when the part before it grew past that, right after it: it spills over and pushes
the parts after it, across region cuts too, as long as each pushed item stays where the engine reaches its home region
(`wram-reach`: low WRAM ends at `$1FFF`, a `bank` region's items stay in their bank) and each item stays inside or outside the
saved blocks as vanilla had it (`wram-save-block`, until W8). A gap, a part's free end or a removed pad nothing reads ends
the push. Past the end of a bank: `wram-region-full`.

### 0.2 Moving and resizing *(W2, v0.475.0)*

A variable moves when implode can rewrite every operand that reaches it. The **reader census**
(`evermore/map/<release>.wram-readers.json`, written by `node tools/open-evermore/wram-census.mts` from the vanilla CDL
library) lists, per vanilla place, the instructions that reach it: ROM addresses and offsets, no ROM bytes, so it is
checked in and implode needs no library. Per vanilla variable it is one of:

- **movable** (388 groups, 3,448 operands): every reader is an absolute or long operand whose base lies inside, touching
  nothing outside. Variables that one instruction reaches together are one **group** (an indexed read past an array's end,
  a word across two variables) and move rigidly (`wram-group-split`). `wram-census.mts --part <p>` lists a part's states.
- **pinned** (348): a pointer, DMA, the direct page, a field read on a pointer in X/Y (`lda $0002,y`), indirect modes, a
  wide indexed reach. Moving it is `wram-pinned` with the first blocker; growing it in place is allowed, shrinking not.
- **never reached** in the recording: moves freely (info `wram-unreached`), and may be removed.

Explode declares every census operand as generated table space (blanked in `_base/`); implode writes each from where its
group landed (vanilla's when nothing moved, so G0 holds), and the round trip reads each place back from those operands.
A long operand into the low mirror keeps its bank byte. Resizing: a group of one variable grows freely (the code reads
only its old bytes); it shrinks only where no recorded access reaches past the new end. A script cell written as a
number (`<0x2391>`, `[91 23]`) does not follow a move: implode refuses that move (`wram-script-number`). Event scripts do
not pin anything otherwise: their WRAM operands are save- and temp-area cells by name, and what the engine touches while
a script instruction runs is code, in the census already. A block routine (capped at 128 addresses) that covers the old
place but not the new, or the other way round, refuses the move (`wram-block-routine`).

**The proof.** `prove --stable` builds vanilla (`vanillaMemory`: the tree's names at vanilla's places) and the tree's
layout with every ROM resource at home, plays the playbacks in lockstep and compares WRAM through the move every frame
(`play.mts`: vanilla's byte at `a` against the build's at `b`; the playbacks' own writes are mapped too). 2026-11-27, one
tree with: `ChoiceBoxState` resized 2 → 4 bytes and given a value (absorbed by a shorter pad 22 bytes on), `TERRAIN_COUNTDOWNS`
80 → 82 (spilling through `sprite_cache` and `actors`, absorbed by `mode7`'s removed pad), two `mode7` variables swapped,
and the joypad pair moved in front of the frame counters: 86 variables moved, 848 bytes compared.

| Playback | Frames | Result |
|---|---|---|
| intro 2m20, attract loop | 8,414 + 6,224 | in step, no drift |
| field play (owner's recordings of 2026-10-10, 15:40 and 23:09) | 41,345 + 52,345 | in step, no drift |
| control: the same build with the 445 rewritten operand bytes put back | | leaves step at frame 3 |

With `--random` too (seed 1, intro and attract) the build plays in step; seed 2 on the 23:09 recording leaves step at
frame 831 with or without WRAM moves (a direct-page ROM pointer prove does not translate: ROM layout, not WRAM).

**Not proved.** The census is what the recording reached: an operand in code the play never ran is not rewritten, and an
immediate that holds a WRAM address (a DMA source, `lda #$0F5A`) is not seen. The proof covers the five playbacks;
anything else (shops, the save menu, every boss) is not checked. The 9th projectile alchemy slot (W10) is still refused:
the effect slots are pinned (pointers).

The owner's two checks of v0.474 (a smaller temp[], `count: 9` on `PROJ_ALCHEMY_SLOTS_BASE`) are refused by name still:
temp[] is pinned (the compiler writes its size), and the alchemy slots are reached through pointers. What growth there needs
is in `knowledge/wram/PROJ_ALCHEMY_SLOTS_BASE.md` (W10).

**Names.** One per address, the ones scripts already read cells by (script-model/names.ts `displayNames`: names.json,
then the compiler's MEMORY enum, then the WRAM map), plus the WRAM map's `$7F` entries; sizes from the WRAM map
(`localizations/data/wram-map.md`) for a variable that starts where its entry starts; a variable inside a sized one is
`in` it. Where a script names an array's or struct's first cell otherwise, the whole keeps the WRAM map's name and the
cell is `in` it at offset 0 (`LEVEL_HIGH_ACID_RAIN` in `FORMULA_COMBAT_POWER_ARRAY`). A name the sources give two addresses
is left out (both stay `$7E:xxxx`). The sources still differ at 251 addresses; making the WRAM map the one source is W1b.

## 1. Until WRAM can be allocated: `temp[]` as a placeholder

The compiler's `temp[]` (`COMPILER_TEMP`, `$7E:2834`-`$28FB`, 100 words, `REGION_ROOM_SCRATCH`) is the one block meant
for anyone's use. A kind that grows past the WRAM its ids have may give the new ids cells of `temp[]` as a placeholder,
named in the kind's file (`"experience": "temp[90]"`), taken from the top down: vanilla's room scripts use low cells (`temp[1]`, `temp[3]`, `temp[8]` seen), and a
room's own scripts keep theirs. The price, said in the file: `temp[]` is wiped on every room load and not saved, so the state
lasts one room. Good enough to try a new formula or weapon; not for a release. The real fix is §3.

## 2. The proof of concept: `tools/open-evermore/wram-poc.mts` *(superseded by §0.2; its rules live on in `wram-census.mts`)*

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
| `JOYPAD1_HELD` (`$0104`, 2 B) | 73 | intro 2m20 | **leaves step at frame 473**. Cause (v0.475.0): the library keys a word access by its first byte, so a word read at `$0103`/`$0105` that also touches `$0104` was never counted. The census counts both bytes; `JOYPAD1_HELD` and `JOYPAD1_TRIGGERED` are one group and move in step (§0.2) |

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
