# Secret of Mana — how a map is built and drawn

Everything here was read from Secret of Mana's own code (US ROM, `Secret of MANA`,
2 MB HiROM) with the extension's emulator core and CDL recorder, then checked against
the running game. Nothing about Secret of Evermore applies here unless the SNES itself
explains it. Code: [`src/mana/`](../../src/mana/README.md). Files: `som://rom/`.
How to check a claim yourself: [verifying.md](verifying.md).
RAM addresses: [wram.md](wram.md). Mana maps as Evermore rooms: [evermore-rooms.md](evermore-rooms.md).

Addresses are SNES bus addresses (`$CC:E270` = file offset `$0CE270`).

ROM speed: **SlowROM.** Header at file `0x00FFC0`, map mode byte `$21` (HiROM, slow). No
`STA`/`STX`/`STY`/`STZ`/`STA long` to `$420D` (MEMSEL) occurs anywhere in the ROM (byte search,
US ROM). The game never switches FastROM on. Its code runs in banks `$00–$02` (the routines on
this page) and reads data through `$C0+`. Use: [`docs/exhirom/combo-rom.md`](../exhirom/combo-rom.md) §3.

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
`$7F:4000`, `$80` bytes a row (map `$66`, Potos: piece 13 at 29,28 is placed only while event flag
`$10` is 6-15 — the ground that breaks open). The first placed piece of a layer sets its size
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
shows each picture once, as one rail row with the other ids as variants.

"Same picture" compares the assembled layers at flag value 0 (`pictureKey`, `src/mana/placement.ts`),
not the piece lists: map `$8E` has `$8B`'s and `$8F`'s 31 piece records, but two of them
(piece 234 at 21,7 and 27,6) in swapped order, so a list comparison split Water Palace 2 in two.
Groups cross area lines: `$67` (no area) draws `$88`'s picture, `$1B0` (no area) `$1B4`'s, and `$93`
(Todo Village) and `$14C` (Santa's House) draw the same one. A map no area lists that draws an
area's picture is shown as that room's variant, not under "other" (`src/mana/catalog.ts`).

## Collision — `$02:A043`, `$01:BE15`, `$00:D84C`, `$00:D359`

Each metatile has 4 bytes: index `$CB:0400 + set*384 + half*192 + n` → 4 bytes at
`$CB:0000 + index*4`, copied to `$7F:B800 + n*4` (layer A) / `$7F:BC00 + n*4` (layer B); the
special slots `$C0+k` follow at `$BB00 + 4k` / `$BF00 + 4k`. A character's movement reads the
layer it stands on: bit 7 of its `+$0B` picks `$7F:0000` + `$B800` or `$7F:4000` + `$BC00`
(`$00:D759` for a move, `$01:B737` for the stuck-character search; game: in the headless walks the
movement readers also read `$7F:BCxx`-`$BFxx`). An earlier version of this page said movement reads layer A only.

**Cells are 16 pixels; there is no 8-pixel collision.** Every reader turns a pixel position into
one cell, `(y & $FF0) << 3 | x >> 4`, and reads that cell's one 4-byte record. The position
inside the cell (`x & 15`, `y & 15`) is used only to (a) cut the diagonal half walls along
their diagonal, pixel by pixel (`$01:BE64`-`BEF4`, `$01:BC85`-`BD13`), and (b) round wall
corners: a walker that runs into a wall cell with its probe in the cell's outer 8 pixels is
turned along the wall instead of stopped (result codes 8/9 in `$02`, `$01:BE47`/`$01:BA8A`;
the diagonals have similar 2- and 12-pixel margins). The probe points sit half the walker's
width (`$1A`) to the side and 4 pixels below its position (`$01:B9EA`, `$01:BAE2`).

Who reads what (all reads found statically — every `[dp],Y` / `$7F:000n,X` read through a
pointer set to `$B800`/`$BC00` — and the CDL readers of `$7F:B800`-`$BFFF` while walking headless
from the waterfall map `$80` and after forced loads: the same set, plus the load-time copies):

| reader | what it is | bytes and bits it uses |
|---|---|---|
| `$01:B93E` → `$01:B9EA`/`$01:BAE2` → `$01:BE15`, `$01:BC37`, `$01:BD33`, `$01:BF13` | can the walker move here (per pixel step) | c0 bits 0-2 and 3, c1 bits 4 and 6 (16-bit read), c2 when its high nibble is 1 |
| `$00:D74F` (`$00:D84C`) | the cell the walker has moved into | c0 bits 0-3, c1 bits 0-2 and 4, c0 bit 2, c2 and c3 whole |
| `$00:D359` | what the entered cell does, every frame, from `+$48`/`+$49` | c2 high nibble `$2`, `$3`, `$4`, `$D`; c3 for `$D` |
| `$01:DF37` | a character put on the map | c0 bits 0-1 → its level, c1 bits 0-2 → `+$8E` |
| `$01:B84B` | free-cell search for a stuck character | c0 bits 0-2, c2 high nibble 1 |
| `$01:D293` | the attack probe (cut, strike) | c2 high nibble `$C` / `$F`, c3 |
| `$02:16A9`-`16EB` | the 4-way wall test of another moving kind (`$02:15F8`) | c0 bits 0-1, c2 high nibble 1 |
| `$02:C1D7`, `$02:C195` | the small objects at `$7E:D000` | c0 bits 4-5, c2 high nibble `$F`, c3 |
| `$00:D05E`, `$02:B517` | special cells at load | c1 bit 7, whole record copied |

`$02:19CE`, `$02:234B`, `$02:23F0`, `$02:040C`, `$02:1CE0` also point at `$7F:BC00`, but they
fill or DMA that RAM for another screen mode; they are not map collision.

| byte | bits | meaning (from the code) | evidence | sure? |
|---|---|---|---|---|
| c0 | 0-2 | 0 floor of no level, 1 / 2 floor of level 1 / 2, 3 wall, 4-7 no wall (`CMP #4; BCS`) | `$01:BE1D`; game | yes |
| c0 | 2 (values 4-7) | also: the walker keeps its sprite priority (c1 bits 0-2 are not applied) and its level | `$00:D69A`, `$00:D876` | code |
| c0 | 3 | flips the walker to the other layer: `+$0B` bit 7 toggles, level bits cleared; bit 3 of the walker's state stops it flipping back until it leaves the cell. Never solid (`$01:B9E0`) | `$00:D864`-`D874`; game | yes |
| c0 | 4-5 | a height, `$00`/`$10`/`$20`/`$30`, for the objects at `$7E:D000` | `$02:C1D7`, `$02:C293` | code; objects not seen |
| c0 | 6-7 | no reader found | | — |
| c1 | 0-2 | sprite priority from this cell on (0 = keep the last) | `$00:D6A0`, `$00:F6D6`; game | yes |
| c1 | 3, 5 | never set in the ROM's maps; no reader found | | — |
| c1 | 4 | return cell: entering it takes the party back to the saved return point; a wall for other characters | `$00:D688`, `$00:BBD1`, `$01:CCF5`, `$01:B9CD`; game | yes |
| c1 | 6 | the party may walk onto this special cell ("Special cells") | `$01:B9B3` | code |
| c1 | 7 | special cell ("Special cells") | `$00:D05E` | yes |
| c2 | `$1n`, low 4-7 | diagonal half wall: 4 bottom-left, 5 top-right, 6 top-left, 7 bottom-right | `$01:BE64`-`BEF4` | code |
| c2 | `$2n` | stairs and slopes: movement slowed to half | `$00:D391`; game | yes |
| c2 | `$3n` | pushes the walker: direction `n & 3`, speed `(n >> 2) + 1` pixels per frame | `$00:D3DD`; game | yes |
| c2 | `$4n` | asks for sound `$7n` on entering; only in map `$1FF` (not a real map) | `$00:D37A` | code |
| c2 | `$Cn` | cut by a weapon: becomes metatile c3 ("Cuttable tiles") | `$01:D376` | interpreter |
| c2 | `$Dn` | step event `c3*16 + n`; only in map `$1FF` | `$00:D362`, `$00:D449` | code |
| c2 | `$Fn` | strike event: hitting the cell runs event `c3*16 + n` | `$01:D382`, `$01:CD95` | interpreter; game (map `$3E`) |
| c2 | other | `$0n` and `$5n`-`$Bn`, `$En`: nothing reads them; only 0 occurs | | — |
| c3 | | with `$Cn` the new metatile, with `$Dn`/`$Fn` the event's high bits; 0 everywhere else | | yes |

Value counts are layer A over the 407 real maps (`$1FF` reads past the data and is left out).

**c0 bits 0-2, level.** Stepping on a 0-2 floor sets the walker's level to it (`$00:D884`); a
level-1 floor is solid to a walker on level 2 and the other way round (`$01:BE2B`:
`(c0 ^ level) & 3 == 3`). That is how bridges and their undersides work. Most walkable ground
is level 2 (map 128: 1184 cells, 3358 walls, 2 level-1, 48 shared). Values 4-7 are rare:
`$15` is the deck of the log bridge in maps `$80`/`$65` (cells 30-33, 67), so a walker on it keeps
the level and sprite priority it had at the bridge end; 542 cells in 20 maps, `$16` 12 cells in map `$3C`.

**c0 bit 3, layer switch.** `$1B` is the walker's `+$0B` while it moves (written back at
`$00:D8AE`). On a bit-3 cell `$1B = ($1B ^ $88) & $F8`: layer bit 7 flips, bit 3 marks "already
flipped", the level is cleared; a cell with c0 & 7 = 3-7 clears bit 3 again, a 0-2 floor sets
the new level. Characters that follow (not `+$2C`) take the leader's layer bit instead
(`$00:D890`). Checked in the game: on map `$80`, with bit 3 set in RAM on the metatile ahead of
the boy, his `+$0B` went from 2 to `$82` as he walked onto it. In the ROM: `c0 = $18`, 84 cells in
18 maps. (This page used to call it "changes the walker's level".)

**c0 bits 4-5, height.** `$02:C1D7` reads `c0 & $30` under one of the small objects that
`$02:BF1D` spawns, three at a time, at `$7E:D000 + slot/8` when a character's animation reaches
command `$FB` (`$00:F98D`). Each has a height (`+6`) that rises and falls along a sine table
(`$00:FD22`); `$02:C293` ends it (`+7` = 8 frames) once its height is no longer above the cell's
`c0 & $30`, and `$02:C171` adds the cell's value to the height. What these objects are on screen
has not been seen (none was spawned in the headless runs, which had no weapon). Values:
`$1x` 899282 cells (floors `$10`-`$13`), `$7x` 285965 (`$73`, walls, 216 maps), `$0x` 675,
`$2x` 454 (`$23`, 8 maps), `$5x` 25.

**c1 bits 0-2, sprite priority.** When a walker enters a cell whose c0 bit 2 is clear and whose
`c1 & 7` is not 0, that value goes to `+$8E` (`$00:D6A0`, `$00:D2B5`; `$01:DF7E` sets it when a
character is placed; `$00:F0A2` copies one character's to all three party members). The sprite builder
(`$00:F6D6`) changes the OAM priority bits of the character's own attribute (`+$8B`, priority 2 for
the three party members: `$2B`, `$2D`, `$2F` seen): 4-7 give priority 0-3; 2 keeps 2 and draws the
pieces marked in the sprite frame (piece byte bit 7) one higher; 1 and 3 give priority 1 with the marked
pieces at 2 (the code: "Half-hidden characters" below). Seen in the game: walking up map `$80` column 18, `+$8E` was 7 on rows 54-53 (`c1 = 7`)
and 2 on rows 52-51 (`c1 = 2`); the OAM priority itself was not compared piece by piece. Values: 6 (1028901
cells, 405 maps), 2 (66716), 7 (65167), 0 (25611), 5 (6, maps `$E9`-`$EB`).

**c1 bit 4, return cell.** When the character the player controls (`+$2C` non-zero, `+$0E`
bit 7 clear, `$FF` and `$D0` zero) enters it, `$00:D688` sets its `+$4A` to `$80`; the main loop
(`$00:B613`) then runs `$00:BBD1`: the party stops, `$01:CCF5` copies the return point
`$7E:CE00`-`CEFF` to `$7E:CD00` and puts `$CD08` into the map id `$DC`, and the next map loads.
The return point is saved by `$01:CBCF` (current state `$CD00` → `$CE00`), called from elsewhere.
For characters in slots `$600` and up the cell is a wall, and for party members too while `$D0` or
`+$1C` is non-zero (`$01:B9CD`). Checked in the game: on map `$80`, with c1 bit 4 set in RAM on
the metatile ahead and `$7E:CE08` = `$2B`, walking onto it ran `$00:BBD1`, `$01:CCF5` and the
map loader with `$DC = $2B`. In the ROM: always the record `10 10 00 00`, 71 cells in 39 maps,
mostly two side by side (map `$2B` cells 13-14, 78; map `$F1` cells 12-13, 22).

**c2, the cell's effect.** When a walker moves into a cell whose c2 differs from the last
one's (`+$4D`), c2 and c3 go to `+$48` / `+$49` (`$00:D8B3`). Each frame `$00:D359` acts on
`+$48`'s high nibble (unless `+$60`/`+$1C` is non-zero or `$F1` bit 7 is set):

- `$2n`, stairs and slopes. On frames where the frame counter `$F4` has bit 2 clear, movement
  along the slow axis is cancelled — vertical for `$20`/`$21`, horizontal for `$22`/`$23` — so the
  walker goes at half speed. On `$22`/`$23`, on even frames with bit 2 set, horizontal movement
  also moves the walker up (`$22`, going right) or down (`$23`, going right) by as much. When
  movement is cancelled every 8th frame, the character the player controls asks for sound
  `$EF` (`$00:BB11` writes `$95`, which `$00:B565` passes to `$7E:1E00`; that `$95` is the sound
  request is read from the code, the sound was not listened to).
  Seen in the game on map `$80`: up the cliff stairs at column 18 (`$21`) the boy moved 12 pixels in
  12 frames instead of 24; walking right onto the log bridge (`$22`, cells 28, 67-68) he slowed
  and rose 8 pixels onto the deck. In the ROM: `$21` 3774 cells in 205 maps (stairs), `$23` 289,
  `$22` 10 (the bridge ends in Potos Falls).
- `$3n`, push. After the normal move (`$00:D482`) the walker's step gets `(n >> 2) + 1` pixels
  added toward `n & 3`: 0 up, 1 down, 2 left, 3 right. Seen in the game: map `$80` cell 18, 46
  (`$32`): the boy drifted left 1 pixel per frame. In the ROM: 4046 cells in 35 maps — the
  Kakkara Desert maps, the Sunken Continent, Gaia's Navel, the Potos Falls river, the Sandship,
  speeds 1-3 (4 is never used).
- `$4n` asks for sound `$7n` unless that sound is the current request, and `$Dn` runs event
  `c3*16 + n` once (it clears `+$48`) for a character with `+$71` bit 7 while `$D0` is 0. Only
  map `$1FF` has these values.

`$1n`, `$Cn` and `$Fn` are not handled here: the movement code reads `$1n`, the attack probe
`$Cn`/`$Fn`.

**c2 = `$Fn`, strike event.** In the attack probe (`$01:D376`, see "Cuttable tiles"), a cell
with c2 = `$Fn` hit by a party member whose `+$2C` is set, when no target was found yet this
frame, stores `$8000 | (c3*16 + n)` in `$0E` and the attacker in `$1C` (`$01:D389`). After the
three party members, `$01:CD95` runs `$0E & $0FFF` through the event runner `$01:E76D` when `$D0`
is 0 (bit 15 tells a cell from a character target). The `$7E:D000` objects run the same event when
they come down on such a cell (`$02:C195`). Checked by running `$01:D293` on the interpreter with
the game's loaders: maps `$3D`, `$11D`, `$2B`, `$19F` → `$0E` = `$86F8`, `$81AF`, `$8568`, `$84C0`;
0 with `+$2C` clear or on a plain cell. **Seen in the running game:** the boy was sent to map `$3E`
(through a return cell set up in RAM, see c1 bit 4), placed below the strike cell 33, 31 and B pressed:
`$01:D389` ran, `$0E` became `$86F8` with `$1C` = 0 (the boy), and `$01:CD95` → `$01:CDC1` ran event
`$6F8` through `$01:E76D`. Nothing visible followed with his weapon (type 1): no sound request
(`$95`), no event lock (`$D0`), no movement, no map change, the screen unchanged over 900 frames.
What `$6F8` does (perhaps something only for another weapon) is not decoded. The attack probe only
runs on maps whose header byte 7 is `$FF` (`$ED` bit 7, `$01:CDDF`), and `$00:BEAA` clears that bit
while event flag `$7E:CF00` is 0, as it is right after the opening; the run set `$CF00` = 1 first.
In the ROM: 131 cells in
27 maps; `$F8`/`$6F` (event `$6F8`) 114 cells in 19 maps (Lofty Mountains, Mana Fortress, …),
`$FF`/`$1A` (`$1AF`) in Gaia's Navel and the Underground Palace, `$F5`-`$F8`/`$56` (`$565`-`$568`)
in the Sunken Continent, `$F0`/`$4C` (`$4C0`) in the Grand Palace.

## Half-hidden characters (wading, tall grass) — `$00:F6D6`

A character standing in water with only its upper body clear is a priority trick, not
separate art: no "submerged" frames or tiles were found, and none are needed. The same
walking frame is drawn with some of its pieces in front of the scenery and the rest behind
it. Three things combine:

1. **The cell.** Collision c1 bits 0-2 go to the character's `+$8E` when it enters the cell
   (c1 above). Value 2 is the "split" value.
2. **The frame.** Each piece of a sprite frame carries a mark bit. `$00:F6D6` raises the
   marked pieces one priority level when `+$8E` is 1-3.
3. **The hardware.** In Mode 1, high-priority BG tiles sit between OBJ priority 2 and 3, so
   the unmarked pieces (priority 2) go behind the water's high-priority tiles and the marked
   ones (priority 3) stay in front.

The sprite builder, per character (X = the character's base, `$0C`/`$0D` = `+$8A`/`+$8B`, the
character's own OAM attribute word, priority 2 for the party):

```
00:F6D6  LDA $E08E,X        ; +$8E, from c1 bits 0-2
00:F6D9  BEQ $F6F6          ; 0: attribute unchanged, no split
00:F6DB  CMP #$04 / BCS $F6EA
00:F6DF  SEC / ROR $01      ; 1-3: $01 bit 7 = "split this sprite"
00:F6E2  CMP #$02 / BEQ $F6F6   ; 2: keep priority 2
00:F6E6  LDA #$30 / BRA $F6F2   ; 1, 3: priority bits ^ 3 -> priority 1
00:F6EA  AND #$03 / ASL x4 / EOR #$20   ; 4-7: priority (v & 3), whole sprite
00:F6F2  EOR $0D / STA $0D
```

then for each piece, 2 bytes read through `[$10]` (`$00:F706`):

```
00:F70E  XBA / ASL / ROR $00   ; byte 1 bit 7 -> $00 bit 6
00:F712  XBA / ASL / ROR $00   ; byte 0 bit 7 -> $00 bit 7
         ...                    ; bits 0-6 of each byte: signed offsets, negated by the flips in +$88
00:F747  LDA $00 / BPL         ; piece not marked -> plain attribute
00:F74B  BIT $01 / BPL         ; sprite not split -> plain attribute
00:F74F  AND #$40 / EOR $02 / ORA $0D / CLC / ADC #$10   ; priority + 1
00:F760  STA $E093,X           ; the piece's attribute (+$90-$93 per piece, X += 4)
```

So a frame piece is 2 bytes. **Byte 0**: bit 7 the priority mark, bits 0-6 a signed offset
negated by the vertical flip (`+$88` bit 7), so the y offset. **Byte 1**: bit 7 flips the piece
horizontally (attribute bit 6), bits 0-6 a signed offset negated by the horizontal flip, so the
x offset. What each `+$8E` value gives, for a character whose own priority is 2 (`+$8B` = `$2x`):

| `+$8E` | unmarked pieces | marked pieces |
|---|---|---|
| 0 | unchanged | unchanged |
| 1, 3 | 1 | 2 |
| 2 | 2 | 3 |
| 4-7 | `v & 3` | `v & 3` |

The `EOR` assumes priority 2 to start from: for a character with another `+$8B` priority the
result is relative, not absolute.

It works for every character the sprite builder draws (party, enemies, people), since only
the mark bits in each frame decide where the cut falls. The same value 2 is on 66716 cells
(c1 above), far more than the game's water, so the same split very likely also covers tall
grass, bushes and railings; that is a guess from the count, not checked per map.

Why the hidden part still shows through tinted water, rather than vanishing: where a map's
display mode puts OBJ on the sub screen and adds it into the water's layer (as mode 1 does:
TS `$11` = BG1 + OBJ, CGADSUB `$42` = BG2 half-added; "Palettes and display"), the water pixel
is drawn as half water, half the sprite behind it. That is SNES colour math; the map in the
user's screenshot was not identified, so its own TS/CGADSUB were not read.

Not checked yet: that the marked pieces of the party's walking frames are the upper body
(frames are not decoded; read from the code only), and OAM priority piece by piece in the
running game while wading. To check: `tools/mana/find-picture.js` for a wading map, stand
the boy on a `c1 = 2` cell, dump OAM and compare each piece's priority with byte 0 bit 7.

## Special cells — `$00:D03A`, `$02:B517`

On load the game scans layer A; every cell whose c1 bit 7 is set gets its own metatile
slot `$C0+k` (tile words to `$7F:C600+8k`, collision to `$7F:BB00+4k`) and the cell is
rewritten to `$C0+k`, so the game can change that one cell later. c1 is the kind: `$80`
(2105 cells), `$C0` (191), `$86` (50: cave entrances), `$87` (22: signposts), `$85` (6: a gate),
`$82` (3: a water edge) — the descriptions are what those cells look like, not code.

The slot value is what runs the cell's event (below), and c1 bit 6 says how: in the
movement code (`$01:B9A3`) a party member may not enter a cell with value `>= $4D`
unless the word at `$7F:B800 + cell*4` has bit 14 (c1 bit 6) set — so `$C0` cells are
walked onto, `$80`-kind cells are solid and run their event when walked into (the Mana
Sword in the stone at Potos Falls, `$80`, cells 47,50-51, event `$847`).

### Cuttable tiles — `$01:D293`, `$01:D376`

A weapon changes a cell through its collision bytes 2 and 3. `$01:CE19` calls `$01:D293`
for an entity whose attack is out (`$E0C2,X != 0`); it probes the cell at the entity's
position plus a reach toward its facing (`$56`), in layer A (`$7F:0000`, collision
`$7F:B800`) or layer B (`$7F:4000`, `$7F:BC00`) by `$E00B,X` bit 7. At `$01:D376` it reads
c2/c3 of that cell: when c2 is `$Cn` and the attack's weapon type `$E068,X` matches `n`
(`$01:D3AB`), c3 is stored into the cell (`$01:D3F5`): **the cell becomes metatile c3**.

| n | weapon types (`$E068`) that cut it |
|---|---|
| 0-7 | that type only |
| 8 | 1 and 2 |
| 9 | 3 and 4 |
| A | 5 and up |
| B | below 3 |

In the ROM: 3858 cells in 63 maps (3088 layer A, 770 layer B); n = 1 (1117), 2 (1929),
8 (812). Example: map `$81`'s bushes are metatile `$05` with collision `13 00 C8 5F` and
become `$5F`, cut stubble. Which weapon each type number is has not been read yet.
`c2 = $Fn` is the other branch: a strike event ("Collision").

Checked by running `$01:D293` on the interpreter with map `$81` loaded by the game's own
loaders (`tests/mana/mana-rom.test.js`): the bush becomes `$5F` for types 1 and 2 and
stays for 0, 3 and 5; plain grass never changes. Not yet seen in the running game (that
needs the sword). An earlier version of this page said Mana had no cuttable tiles: it had
searched for writes to the metatile and collision tables, but cutting writes the cell.
Code: `src/mana/cuttable.ts`.

## Objects — `$00:C481`, `$00:DCE3`, `$00:DD55`

After the 8-byte header comes the map's object list: 8-byte records up to the next
map's header. The loader stores its address at `$7E:E802` and its length / 8 at
`$7E:E800`; `$00:DCE3` copies every record into `$7E:C800` (16 bytes each): bytes 0-7 at
+8..+15, +0 = 1 (in use), +7 = byte 3 bit 7 (`$80`) | byte 2 bit 7 (`$40`). A list of `$31` or more
records sends the game into an endless loop (`$00:DCE8`). Map `$1FF`'s list would be
1009 records, and for 13 maps (0, 1, 2, 4, 5, 7, `$F3`, `$18E`, `$1E2`, `$1E4`-`$1E7`) the next
header lies before their own; `mapObjects` returns no objects for all of these.

| byte | meaning |
|---|---|
| 2, 3 | cell x, y in bits 0-6 (bit 7: the `$C807` flags) |
| 6-7 | kind word: `$C001` in 1350 of the 2179 records (enemies on the maps tried) |
| 0, 1, 4, 5 | not named yet (not an event-flag gate: all 22 of map `$10`'s are copied) |

When a record's character is spawned, +0 becomes `$81` and +3 its entity slot (`$7E:E600`,
`$E800`, … `$200` apart); it stands at `cell * 16 + 4` pixels. Checked headless after
forced loads of maps `$10` and `$81`: all records copied, and the 2 + 4 spawned entities
stand exactly there (`src/mana/objects.ts`). Only records near the camera were spawned.
Their sprites are not decoded.

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

## Editing a map in the plugin — what is and is not a cell's own

The Maps panel's editor (`src/mana-maps/webview/editor.js`; plan and reasons:
[docs/architecture/multi-game.md](../architecture/multi-game.md)) edits a map in the terms
the facts above allow, and **saves nothing**: Mana's map data is compressed and a changed map often
would not fit its old slot, so there is no write-back and no way to play an edited map (both need a
re-encoder, which does not exist).

| Thing | What the game has | What the editor edits |
|---|---|---|
| picture | a metatile number per cell in each layer (layer B with its own size, repeated) | the number, per cell; layer B's cell shows in every repeat |
| collision | **per metatile** (4 bytes, "Collision") — a cell has none of its own | nothing directly: painting a metatile changes the cell's picture and collision together; the overlay is recomputed from the metatiles |
| step events | cell → event word through the metatile number (`$C0 - b` and up) or the special-cell slot ("Step events"); the words are one list per map | a list of `{x, y, event}` read off the original map; add / move / delete / set the number. It is the cell → event result, not the encoding: painting a metatile does not change it |
| objects | 8-byte records ("Objects"); bytes 2-3 position (high bits are flags), 6-7 the kind word; others unnamed | place / move / delete, position and kind word; every other byte kept as read (a new object copies the selected one's bytes, else kind `$C001`, the commonest). At most `$30` (a list of `$31` stops the game) |
| characters | the 8-byte records above; several can stand on one cell (e.g. Water Palace 2: three at 17,38, kinds `$420C`-`$420E`); enemies and people are not told apart | listed together as "Characters"; one ring with a count per cell, the only things drawn as circles |
| event-flag pieces ("map changes") | a piece is placed only while its flag is in range (`$00:CB90`): the map changes as the story moves on | shown as Evermore draws an object: an area box with its states (state 0 = every flag 0, one state per flag value that changes cells), each state's cells outlined; pick a state to see the map with it; read-only (`src/mana/flag-pieces.ts`) |
| picture variants | many map ids draw the same picture (same sets and pieces) with different characters and scripts ("Areas") | a variant bar on the card's right edge opens another variant |
| scripts | what an event does is not decoded | shown as the event number only |

Changed cells are redrawn from the metatile sheets (`som://rom/maps/<hex>.tiles.a.png` / `.b.png`)
with each character in its own palette, colour 0 transparent, over the real picture. BG priority and
colour math are not applied to them (they need the whole screen), so a changed cell can look slightly
different from what the game would draw. `som://rom/maps/<hex>.edit.json` carries the editable data;
`tests/mana/mana-rom.test.js` checks it against the library cell by cell.

## Not done yet

- Character objects are placed but not drawn (sprites not decoded), and most of their
  bytes are not named; what each event does is not decoded; which weapon each weapon type
  number (`$E068`) is. Step events say which event runs, not where
  a door leads.
- Pieces hidden by event flags use flag value 0 (a new game).
- BG3 (weather, text) and parallax scrolling of layer B are not drawn.
- Layer B's own collision (`$7F:BC00`) is not drawn, although a walker on layer B (after a c0
  bit 3 cell) moves by it. The `$7E:D000` objects that read c0 bits 4-5 are not identified;
  c0 bits 6-7 and c1 bits 3 and 5 have no reader.
- Writing an edited map back (re-encoding pieces and stamps) and playing it; decoding event scripts.
