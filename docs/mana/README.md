# Secret of Mana — how a map is built and drawn

Everything here was read from Secret of Mana's own code (US ROM, `Secret of MANA`,
2 MB HiROM) with the extension's emulator core and CDL recorder, then checked against
the running game. Nothing about Secret of Evermore applies here unless the SNES itself
explains it. Code: [`src/mana/`](../../src/mana/README.md). Files: `som://rom/`.
How to check a claim yourself: [verifying.md](verifying.md).

Addresses are SNES bus addresses (`$CC:E270` = file offset `$0CE270`).

## Loading order — `$00:C481`

Map id in `$DC`. Header pointer `$C8:7000 + id*2` (16-bit, bank `$C8`), 8 bytes:

| byte | goes to | used for |
|---|---|---|
| 0 | `$1C` → `$01:F403` | BG character list (`& $3F`); whole byte = animated-tile slot for `$01:F5CE`; bit 7 = animated tiles on (`$01:B0EC`); bit 6 = palette animation (`$01:B17E`) |
| 1 | `$1B` | palette set (`& $7F`, `$01:F62D`); bit 7 also starts `$02:BC7E` (palette effects) |
| 2 | `$1C` → `$02:A000` | metatile + collision set (`& $3F`); **bit 6 = half of layer A, bit 7 = half of layer B** |
| 3, 4 | `$02:AB03`, `$C45D` | not used for drawing |
| 5 | `$30` → `$02:AA60` | display mode (`& $3F`) |
| 6, 7 | `$94`, `$C524` | not used for drawing |

Trap: `$02:A000` tests the half bits with `BIT $1B` while the accumulator is 16-bit,
so N/V come from bits 15/14 of `$1B/$1C` — byte **2**, not byte 1. Reading byte 1
draws Gold City (`$71`) with the wrong half (3% of pixels right instead of 100%).

## Pieces and layers — `$00:CB90`, `$00:CD93`

`$C8:5000 + id*2` (513 pointers: maps 0–511 and an end) points to a list of `$FE`
(next records on layer A) / `$FF` (layer B) markers and 5-byte records
`[flag, min<<4|max, piece lo, x<<1|bit8, y<<1|bit9]`. A record is placed when
`min <= $7E:CF00[flag] <= max`. Layer A is decoded into `$7F:0000`, layer B into
`$7F:4000`, `$80` bytes a row. The first placed piece of a layer sets its size
(`$9C/$9D`, `$A0/$A1`); the map is layer A's size. Layer B repeats with its own size.
408 ids have pieces.

Piece pointer: word `$CD:0004 + index*2`; bank `$CD` below word `$CD:0000`,
`$CE` below `$CD:0002`, `$CF` below `$CD:0004`, else `$CC`.
Piece: `[w-1<<1|s, h-1<<1|s]`, optional stamp table (when either low bit is set:
entries `[w-1 | h-1<<4, data…]`, each ended by a byte `>= $F8`, `$FF` ends the
table), then the stream. The cursor walks rows of the piece inside the shared
128-wide buffer, so back-references can read cells outside the piece.

| byte | cells written |
|---|---|
| `00-BF` | the byte |
| `C0-DF` | `(b&7)+1` × the value `((b>>3)&3)+1` cells back |
| `E0 m` | `(m&$7F)+1` cells copied from 1 row (m<$80) or 2 rows above |
| `E1-E7` | `(b&7)+1` cells from the row above |
| `E8-EF m` | `(m&$7F)+1` cells copied from `(b&7)*2 + (m>>7) + 1` cells back (overlapping) |
| `F0 m` | `(m&$7F)+1` cells, previous ±1 each (− when m≥$80) |
| `F1-F7` | `(b&7)+1` cells, previous +1 each |
| `F8-FF` | stamp `b&7` will be drawn here (after the stream, `$00:CD4B`); skips one cell |

The stream ends as soon as the last row is full, even mid-opcode. The mark list at
`$7F:FF20` holds at most 56 entries.

## 16×16 metatiles — `$02:A069`

`$CB:4000 + set*3` → MSB-first bit stream of 384 × 4 BG tilemap words
(TL, TR, BL, BR). One running word; per word:
`00` same · `01`/`10` low byte ±1 (wraps inside the byte) ·
`11 00 n6` +n · `11 01 n6` −(64−n) ·
`11 10 a nnn s6`: a=0 palette bits = nnn, a=1 v/h/priority = nnn, then + signed s ·
`11 11 w16` the word.
Metatiles 0–191 are half 0, 192–383 half 1. Layer A's table goes to `$7F:C000`
(collision `$7F:B800`), layer B's to `$7F:C800` (collision `$7F:BC00`).
Grid values ≥ `$C0` are not tiles (the game writes such values into layer A at
runtime, e.g. 4 cells of the waterfall).

## BG characters — `$01:F413`, `$01:F456`

List `$CC:E27E + set*2` (bank `$CC`) of `[word W, count-1]`, written from VRAM word 0.
Base pointers: four 24-bit words at `$CC:E270`. By W's top bits:
2bpp (`W<$8000`, 16 B/char at base0 + W*16, planes 2/3 = `$FF` if bit 14/13; the
low-word carry is dropped), 3bpp (`$8000-$BFFF`, 24 B at base1 + idx*24, plane 3 by
bit 13), raw 4bpp (`$C000-$DFFF` base2 + idx*32 ×count*32 bytes; `$E000-$FFFF`
base3 + idx*64 × count*64). Trap: the raw paths shift the index with 16-bit `ROR $03`,
so the low bits land in `$04` and are kept.

Animated characters `$360-$37F`: `$01:F5CE` fills them from slot `$C8:0400[byte0]`;
when byte 0 bit 7 is set `$01:B0EC` replaces that with records from slot
`$C8:0400[byte0 & $3F]` ((next − slot)*2 records): record k streams 4 chars from
`$DC:8000 + (b & $3F)*$200`, `$80` bytes per frame (NMI DMA `$00:C319`). Pictures use frame 0.

## Palettes and display — `$01:F62D`, `$02:AA60`

Palette set s: 210 bytes at `$CC:8000 + s*210` → BG palettes 1–7, colours 1–15.
Display mode d: 9 bytes at `$C8:0100 + d*9`: [mosaic, TM, TS, CGADSUB, …, colour 0 lo, hi].
CGWSEL is always `$02`. Colour 0 (backdrop) is bytes 7–8 (`$02:AA8C` stores them at `$0600`).
Layer A is BG1 (tilemap `$5000`), layer B BG2 (`$3800`), Mode 1, chars at 0
(registers read at the waterfall: BGMODE `$09`, BG1SC `$51`, BG2SC `$39`, BG12NBA `$00`).
Example: mode 1 = TM `$17`, TS `$11`, CGADSUB `$42` — BG2 half-added onto BG1: the
translucent waterfalls. Palette 7 colours 8–15 rotate at runtime (waterfall shimmer).

## Areas

The Maps panel groups maps like the fantasyanime.com collection
(<https://fantasyanime.com/mana/sommaps.htm>): each of its pictures was matched
against our renders pixel for pixel (`src/mana/areas.ts`); 266 of 408 maps belong to
one of 52 areas, the rest (arenas, cannon rides, credits, other event states) are
"other". The pictures are not in the repo. Many ids draw the same picture (same
sets and pieces, different objects or scripts, e.g. 7 Kakkara interiors); the panel
shows each picture once.

## Not done yet

- Objects, NPCs, doors and event triggers (`$C8:7000` after the header, `$C8:4000`,
  door table) are not decoded; the reference pictures include some sprites.
- Pieces hidden by event flags use flag value 0 (a new game).
- BG3 (weather, text) and parallax scrolling of layer B are not drawn.
