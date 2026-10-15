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
| 3 | `$B8` (`$00:C49C`) | step events (below); also `$02:AB03` |
| 4 | `$C45D` | not used for drawing |
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

## Collision — `$02:A043`, `$01:BE15`, `$00:D84C`

Each metatile has 4 bytes: index `$CB:0400 + set*384 + half*192 + n` → 4 bytes at
`$CB:0000 + index*4`, copied to `$7F:B800` (layer A) / `$7F:BC00` (layer B). The player's
movement reads layer A only (`$01:BA5B`, `$01:BB5C`, `$01:BD33` → `$01:BE15`).

| byte | bits | meaning (from the code) |
|---|---|---|
| c0 | 0-2 | 0 floor of no level, 1 / 2 floor of level 1 / 2, 3 wall, 4-7 no wall (`CMP #4; BCS`) |
| c0 | 3 | changes the walker's level (`$00:D868`) |
| c1 | 7 | special cell (below) |
| c2 | high nibble 1, low 4-7 | diagonal half wall: 4 bottom-left, 5 top-right, 6 top-left, 7 bottom-right |

Stepping on a 0-2 floor sets the walker's level to it (`$00:D884`); a level-1 floor is solid
to a walker on level 2 and the other way round (`$01:BE2B`: `(c0 ^ level) & 3 == 3`). That is
how bridges and their undersides work. Most walkable ground is level 2 (map 128: 1184 cells,
3358 walls, 2 level-1, 48 shared). Not named yet: c0 bits 4-7, c1 bits 0-6 (bit 4 is tested
at `$01:B9CD`), other c2 values, c3.

## Special cells — `$00:D03A`, `$02:B517`

On load the game scans layer A; every cell whose c1 bit 7 is set gets its own metatile
slot `$C0+k` (tile words to `$7F:C600+8k`, collision to `$7F:BB00+4k`) and the cell is
rewritten to `$C0+k`, so the game can change that one cell later. c1 is the kind: `$80`
(2105 cells), `$C0` (191), `$86` (50: cave entrances), `$87` (22: signposts), `$85` (6: a gate),
`$82` (3: a water edge) — the descriptions are what those cells look like, not code.

No cuttable tiles were found: no code writes the slot tables at runtime except the
save/restore pair `$02:AB30`/`$02:AB42`. Weapon obstacles (bushes, rocks) appear to be map
objects, which are not decoded yet.

## Step events — `$C8:4000`, `$00:B637`

`$C8:4000 + id*2` is a 16-bit pointer into bank `$C8` to a list of event words; the game
runs `word & $0FFF` through `$01:E76D`. Header byte 3 is loaded into `$B8` (`$00:C49C`):

| bits | meaning (from the code) |
|---|---|
| 2 | word 0 is the map's own event, run by `$00:BED3`/`$00:BEE5` |
| 0-1 | `b`: `$00:BEC9` sets `$4D = $C0 - b` |

The special-cell scan (below) rewrites layer A's special cells, row by row, to
`$C0 + k`. When a character's cell changes, `$00:D682` stores the new cell value in
`$E04B,X`; `$00:B637` takes any value `v >= $4D`, clears it and runs word
`(v - $4D) + (bit 2 ? 1 : 0)`. So with `b > 0` the plain metatiles `$C0-b..$BF` are step
events too, wherever they are drawn (`$BF` runs event `$6D8` in maps `$11` and `$3E`).
`$00:B630` returns while `$D0` is non-zero (it is after a forced map load). Header byte 3
is 0 or 4 in 372 of the 408 maps. Some maps have fewer words than cells (map 0 has none):
those cells read past the list and are left out by `mapEvents` (`src/mana/events.ts`).

Checked in the game: `tools/mana/check-events.js` puts each cell's value under the first
character and records the event `$01:E76D` runs — maps `$10`, `$11`, `$3E`, `$80`: 36 of 36.

## Animation — run the game's own code

Three systems, set up at load and stepped every frame by `$00:B0BB`:

| setup | per frame | what moves | upload (NMI `$00:C304`) |
|---|---|---|---|
| `$01:B0EC` (byte 0 bit 7): slot `$C8:0400[b0&$3F]`, records from `$C8:0441` | `$01:B033`, one record per frame (`$F4&7`), modes 0 loop / `$40` ping-pong / `$80` two on one back / `$C0` once then random hold | 4-char blocks `$DC:8000+(b&$3F)*$200` into chars `$360+k*4` | `$DC:[$92]` → VRAM `[$96]`, `$80` bytes |
| `$01:B17E` (byte 0 bit 6): entries `$C8:0000` listed by `$C8:0600[b0&$3F]`, target char `w&$3FF`, mode `w>>12`, speed `(w>>10)&3`; reads the chars back from VRAM | `$01:BFE0` | pixel transforms of single chars (shifts, rotations, …, 16 modes) | `$7F:820A` → `$7F:820C`, `$20`/`$40` bytes or two words |
| `$02:BC7E` (byte 1 bit 7): effect bytes `$C8:087B[$C8:0802[b1&$7F] .. $C8:0803[..]]`: palette bits 0-2, speed 3-4, type 5-7; types 0-2 cycle the colours whose ROM word has bit 15 set (`$02:BEB1`) | `$02:BAD6` (even frames) | CGRAM colours (`$0600` shadow) | the shadow |

Rather than re-deriving every mode, `src/mana/animate.ts` runs these routines on a small
65816 interpreter (`cpu65816.ts`, `snes-bus.ts`) and records which characters and colours
change. Checked against the game: maps 16, 35, 113, 128 and 136 — every animated
character and colour goes through exactly the same set of states over 480 frames, and
nothing else changes in the game. The same interpreter runs the game's `$02:A000` and
`$00:CB90` and reproduces our metatile tables and layers exactly (rom tests).
The Maps panel plays it per cell kind (cells with the same tile words share frames).

## Not done yet

- Objects and NPCs (8-byte records after the header at `$C8:7000`, gated by event flags
  like pieces) and what each event does are not decoded; the reference pictures include
  some sprites. Step events say which event runs, not where a door leads.
- Pieces hidden by event flags use flag value 0 (a new game).
- BG3 (weather, text) and parallax scrolling of layer B are not drawn.
- Layer B's own collision (`$7F:BC00`) is not drawn; the player uses layer A's.
