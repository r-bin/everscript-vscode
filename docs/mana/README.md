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
| c2 | high nibble `$C` | cut by a weapon: becomes metatile c3 ("Cuttable tiles" below) |
| c2 | high nibble `$F` | a second branch of the cut probe (`$01:D382`, needs `$E02C,X`); not named. Layer A: `$FF` 456 cells, `$F8` 116, others < 10 |
| c3 | | with c2 = `$Cn`, the metatile the cell becomes |

Stepping on a 0-2 floor sets the walker's level to it (`$00:D884`); a level-1 floor is solid
to a walker on level 2 and the other way round (`$01:BE2B`: `(c0 ^ level) & 3 == 3`). That is
how bridges and their undersides work. Most walkable ground is level 2 (map 128: 1184 cells,
3358 walls, 2 level-1, 48 shared). c1 bit 6 lets the party walk onto a
special cell ("Special cells"). Not named yet: c0 bits 4-7, c1 bits 0-5 (bit 4 is tested
at `$01:B9CD`: with it set the cell blocks spawned characters), c2 values outside the
three groups above, c3 unless c2 is `$Cn`.

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
`c2 = $Fn` (with `$E02C,X` set) is another branch, not named.

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
[docs/architecture/one-map-editor.md](../architecture/one-map-editor.md)) edits a map in the terms
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
- Layer B's own collision (`$7F:BC00`) is not drawn; the player uses layer A's.
- Writing an edited map back (re-encoding pieces and stamps) and playing it; decoding event scripts.
