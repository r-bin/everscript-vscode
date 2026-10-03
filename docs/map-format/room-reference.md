# Room reference: the blob, segment by segment

One page for "what is in a room, how big can it get, and who reads it". Every
segment below has its byte layout, its limits (the hard ceiling and the largest
value any vanilla room reaches), the code here that reads and writes it, the
engine routine that consumes it, and the document with the detail.

Measured on the vanilla US ROM, all 127 rooms (`0x00..0x7E`; table entry `0x7F`
is not a room). Re-measure with the scripts in §13 after any format change.

> **Coverage audit (v0.117.0).** Every byte of every blob belongs to a field below
> and is read by a decoder here. A blob ends exactly where its furthest object
> record or stamping block ends (no terminator). Fields that are located but not
> fully understood are listed in §12.

---

## 1. Units and grids

| Unit | Pixels | Used by |
|---|---|---|
| **cell** (metatile, "tile") | 16×16 | the grid (Block 2), header width/height, trigger boxes, object positions, cuttable grass, collision words |
| **map unit** | 8×8 | enemy spawns (`add_enemy(x, y)`), `CHANGE MAP` landing (`[x>>3][y>>3]`), the Rooms tab's SVG (`EDIT_UNITS = 2` per cell, `map-editor-paint.js`), the Collision tab's 8px pen |
| **SNES tile** (CHR) | 8×8 | a graphic is 16×16 = four CHR tiles; the tilemap word's `chr` field names the top-left one |
| pixel | 1 | entity positions (`$001A`/`$001C`); tile = `pixel >> 4` (`$8FACCE`) |

The editor's 8px / 16px grid toggles draw map units and cells. A collision code
describes a 16×16 cell at pixel resolution (§9); the 8px pen only edits it in
quarters.

---

## 2. Where a room lives

| | |
|---|---|
| Pointer table | `$9FFDE7` (file `0x1FFDE7`), 4 bytes per room: 24-bit pointer + 1 pad |
| Rooms | 127, `0x00..0x7E` (`MAX_ROOMS`, `src/maps/rom.ts`) |
| Placement rule | a blob sits at `$8000+` of a bank and never crosses a bank (`writeRoomAt`, `src/maps/encode.ts`): the loader walks it with 16-bit offsets |
| Size | no field; = end of the object area (`objectAreaEnd`). Vanilla sizes: `docs/map-format/rom-map.md` |
| Scripts | **not in the blob.** Enter script: packed pointer at `$928000 + 0x1B + 5·room`; triggers name a byte offset into the pointer table at `$928000 + *$928000` (`src/script/room-scripts.ts`) |

Section offsets are walked from length fields only, never searched for:
`parseBlobLayout` (`src/maps/blob-layout.ts`). Writing: `modelFromRom` →
`buildBlob` round-trips all 127 rooms byte-exactly (`tests/memory/rom-export.test.js`).

---

## 3. The blob

```
+0x00  header                 13 bytes                               §4
+0x0D  step-on triggers       [len:2] len/6 × [y1 x1 y2 x2 script:2]   §10
       B-triggers             [len:2] len/6 × (same)                   §10
       tile families          [n:1]   n × family:2                     §5
       CHR descriptors        [n:1]   n × 3                            §5
       Block 1  graphics      [len:2][sub:1][size:2] data              §5
       Section 2 animation    [n:1][len:2] n×4 descriptors, 0xFF, frames   §6
       Section 3 objects      [n:1]   n × offset:2                     §8
       Block 2  grid          [len:2][0x07][w·h·2] Markov stream       §5
       Section 4 cuttable     [len:2] (sources:1, records)             §7
       Block 3  dictionary    [len:2][sub:1][6·N] L1, L2, collision    §5
       object area            records + stamping blocks                §8
```

Block sub-flags: `0x00` raw copy, `0x03` LZSS (`src/maps/lzss.ts`), `0x07` the 2D
Markov grid coder (`src/maps/markov.ts`). The engine's dispatcher is `$8C988D`.
LZSS streams end on 1–3 zero padding bytes inside their declared length.

| Segment | Hard limit | Vanilla max (room) | Decoder | Encoder |
|---|---|---|---|---|
| width × height | 1 byte each; custom maps **16×14** (one screen; the engine draws smaller scrambled, rom-export.md) ..128 (`blank-room.ts`); widget canvases 1..128 | 128 wide (`0x73`), 125 high (`0x37`), 13 250 cells (`0x4B`); smallest 17×15 (`0x50`) | `room.ts` | `custom-room.ts` |
| step-on triggers | 16-bit byte length | 65 (`0x59`); 1205 in all | `room.ts readTriggers` | `encode.ts buildBlob` |
| B-triggers | 16-bit byte length | 58 (`0x0A`); 1065 in all | same | same |
| family entries | 1-byte count; **7 loaded at once** | 14 (`0x0D` and 17 more) | `room.ts` | `custom-room.ts` |
| CHR descriptors | 1-byte count | 8 (`0x53`); 71 rooms have none | opaque (`encode.ts extras`) | copied from the donor |
| graphics (Block 1 + animated) | **264** slots (10-bit `chr`) | 246 Block 1 (`0x37`); 255 with animation (`0x08`) | `room.ts` | `encodeBlock1` |
| animation channels | 255 (1-byte count) | 42 (`0x18`); 1020 in 95 rooms | `animation.ts` | `custom-animation.ts` |
| frames per channel / ticks per frame | 255 / 127 kept (vanilla's own maximum; a longer hold is several frames, `editAnimRuns`) | 24 (`0x38`) / 127 | same | same |
| objects | 255 (1-byte count) | 72 (`0x71`); 1748 in 110 rooms | `room.ts readObjects` | `custom-room.ts` |
| states per object | 255 | 25 (`0x4A`) | same | same |
| stamping block footprint | `tw·th` ≤ 255×255 | 648 cells (`0x06`) | `object-stamps.ts` | `custom-room.ts` |
| cuttable sources / records | 255 sources (1 byte) | 72 / 94 (`0x38`); 7 rooms | `cuttable-grass.ts` | `custom-room.ts` |
| dictionary (stamps) | grid + 8·N ≤ 32 768 B (`$7F0000` window) | 2131 stamps (`0x37`); 32 680 B (`0x65`) | `room.ts` | `encodeBlock3` |

The WRAM window is measured, not traced as a hardware limit (`budget.ts`):
past the vanilla maximum the editor warns rather than refuses.

---

## 4. Header (13 bytes)

Read by `$908F80..$909050`. Detail and every value's meaning:
`building-a-room-from-scratch.md` §3; edited on the Info tab
(`map-editor-info.js`, `_edit.header`, written by `applyHeaderOverrides`).

| Byte | Field | Goes to | Notes |
|---|---|---|---|
| 0 | trigger origin X | `$0F86` | added to the player's cell X before testing trigger boxes |
| 1 | trigger origin Y | `$0F88` | same for Y |
| 2 | width (cells) | `$08EE` | also the camera's right limit; grid stride = `2w` |
| 3 | height (cells) | `$08F0` | camera's bottom limit |
| 4 | main screen `TM` | `$212C` | bit 0 BG1 canopy, 1 BG2 terrain, 2 BG3 HUD, 4 OBJ. `23` in 126 rooms (`0x4B`: `22`) |
| 5 | sub screen `TS` | `$212D` | blend operands |
| 6 | `CGADSUB` | `$2131` | colour math |
| 7 | `CGWSEL` | `$2130` | `2` in every room |
| 8 | room effect | `$7E241F` | per-frame routine, jump table `$908E74`. `1` = BG1 offset (Oglin cave's lantern), `2` = camera-distance sprite sorting (`$8FC7E8`, jungles), `5` = heat-shimmer wave (`0x52`) |
| 9–10 | camera flags | `$0F84` | only bit 14 is read (`$909ECC`: camera follows upward tighter). 0 in every room |
| 11–12 | reserved | — | skipped (`INY INY`); 0 in every room |

---

## 5. Graphics, families, the grid and the dictionary

**A cell** holds a metatile id; the id indexes the room's **dictionary** (Block 3),
one entry per distinct `{canopy word, terrain word, collision word}`. The editor
calls an entry a **stamp**. `id = base + 8·index`, `base = w·h·2`: ids are
WRAM offsets in bank `$7F` (`$909460` streams them to VRAM).

**WRAM after load** (`$7F0000`): the grid (`w·h` 16-bit ids), then one 8-byte
entry per stamp: `+0` canopy word, `+2` terrain word, `+4` collision word, `+6`
the Markov coder's context. Block 3 stores the three words as three planar slices
(`$9091B0` divides the size by 6).

**The two layers** (Mode 1, `map-foreground-and-parallax.md`):

| Layer | Block 3 slice | BG | Editor name |
|---|---|---|---|
| Layer 1 | 0 | BG1 | **canopy** / front / foreground: drawn over the terrain; with tilemap priority set, over sprites too |
| Layer 2 | 1 | BG2 | **terrain** / ground / floor |

124 rooms have canopy art; `0x15`, `0x4B` and `0x50` have none.

**The tilemap word** (canopy and terrain alike):

```
15  14  13  12 11 10  9 .......... 0
 V   H   pr [palette]  [    chr     ]
```

- `chr` (10 bits): the graphic's CHR index. **Slot** = `floor(chr/0x20)·8 + floor((chr%0x20)/2)`:
  0..263, which is the 264-graphic ceiling. Slots 0.. are Block 1's graphics in
  order, then each animation channel's frame-0 graphic (§6).
- palette (3 bits): **which family slot**, stored as slot + 1; 0 is the HUD's.
- `pr` (bit 13): BG priority; canopy art with it set covers sprites.
- `H` (bit 14), `V` (bit 15): flips. A flipped word costs a stamp, not a graphic.

**Block 1** is the room's graphics list: 16-bit deltas, accumulated at `$908E85`
into graphic ids, loaded through the `$EE0000` pointer table by `$8CC88C`
(`map_tile_graphics_decompression.md`). 115 rooms LZSS, 12 raw.

**Tile families** are background palettes: 16 colours each from `$9CC322 +
32·id` (`map_palette_extraction.md`). `$90D020` loads **at most 7**, starting at
entry **`MAP_PALETTE`** (`$7E2437`, 0 on room load) — so a room may store
**alternate sets** after the first seven. 22 rooms store 8–14 entries (`0x5E`, `0x60`, `0x75` store 8; `0x44` 12; 18 rooms 14); scripts
switch sets by writing `MAP_PALETTE` (Thraxx's orange/white, Ebon/Ivor Keep,
dark rooms), and `$90CBB3` reloads when it changes. A family is a ROM id tied to
an area, never a friendly name.

**CHR descriptors** (`extraGraphics`): 3 bytes, read at `$9090A6` and handed to
`$90D50F`: byte 0 bits 4–6 slot group, bits 0–3 entry; bytes 1–2 a graphic id.
They reserve extra graphics in the slot tables `$13D2/$1372/$13F2/$13B2`
(`building-a-room-from-scratch.md` §4.3). What draws with them is not traced.

**Cuttable tiles** are not a flag: a cell is cuttable while its metatile id is a
**source** in Section 4 (§7).

---

## 6. Section 2: animated tiles (channels)

```
[count:1][len:2]                         len excludes these 3 bytes
count × [countdown:1][frames:1][offset:2]   offset from the descriptor table
0xFF                                     ends the descriptors
frames: [ticks:1][graphic:2] …            channel i runs to channel i+1's offset
```

A **channel** swaps the graphic in **one graphics slot**, so every cell whose word
names that slot changes together; a cell has no clock of its own. Frame 0's
graphic is appended to the room's graphics list (slots after Block 1), and that is
the slot the channel drives. Channels run independently (no common period) and
never touch collision. Ticks are 60 Hz frames.

Code: `src/maps/animation.ts` (parse), `custom-animation.ts` (write),
`vanilla-animation.ts` (vanilla's timing census). Docs: `map_animated_tiles.md`;
the editor's model: map-editor-rules §6 and `docs/animation-tab-plan.md`.

---

## 7. Section 4: cuttable grass

```
[len:2]                                  0 = no cuttable tiles, and no further bytes
[sources:1]                              also seeds the Markov coder ($0FC4)
records: [steps:1][source:2][next:2]…[0x0000]
```

`$90A6EF` swaps a cut cell's metatile along its record's sequence. Sources must be
dictionary indices `0..N-1`, which is why the same byte seeds Block 2's literal
counter. `steps` is `0x01` in all 206 vanilla records (meaning unverified); four
rooms repeat a source (which one wins is unverified; we keep the first).
At most 24 swaps run at once (`$8E0FD2`). Code: `src/maps/cuttable-grass.ts`;
doc: `cuttable_grass_mechanics.md`; the editor's layer: `_edit.cut`.

---

## 8. Objects (Section 3 + the object area)

Section 3 lists one 16-bit offset per object into the **object area** (right after
Block 3). An object record:

```
[maxState:1]
maxState × [hold:1][x:1][y:1][stamp:2]   descriptor s turns state s into s+1
```

and the stamping block it points at (shared between descriptors in vanilla):

```
[tw:1][th:1]   then per cell, row-major: a mask byte every 8 cells (LSB first);
               set bit -> a 16-bit XOR delta follows inline, clear -> untouched
```

- **A descriptor is a transition**, XORed into the grid (`$90A4E8`). An object
  with `maxState` descriptors has `maxState + 1` states; state 0 is the grid as
  decoded. Collision follows, because it lives in the stamp the new id names.
- **`hold`** (byte 0) is how many ticks state `s` stays up while a script steps
  through it — not a width. The script sets a target (`object[n] = v`; `v` above
  the last state clamps to it, so `0x7E` means "the last"; bit 7 set means 0); the
  per-frame tick `$90A429` takes one state per step: first step on the next tick,
  then `max(1, hold[s])` ticks per state on the way, up or down. State 0 and the
  last state are never held. A value with bit 15 set takes `$90A3AC` instead and
  ignores the holds. Detail: `map_objects.md` §4b–§4c.
- State lives in WRAM: current `$7E10CE,X`, target `$7E107E,X`, countdown
  `$7E111E,X` (`$FF` idle).

Code: `room.ts readObjects`, `object-stamps.ts`, `objects.ts` (apply a state),
`custom-room.ts` (write). Editor: `map-editor-objects.js`, `-object-list.js`,
`-object-holds.js`.

---

## 9. Collision word (Block 3 slice 2)

One 16-bit word per stamp, so per cell. **Never read it by hand**: use
`src/maps/collision.ts`. Authority: `map_collision_mechanics.md`.

| Bits | Field | Meaning |
|---|---|---|
| 3..0 | geometry | which part of the cell is solid (16 codes, `$909DE8`); **or the drift direction when bit 13 is set** |
| 5..4 | plane | elevation level 0..3 (`$8FA914`) |
| 6 | see-through | plane-transparent: open from other planes, keeps yours |
| 7 | — | never set |
| 11..8 | entity gate | active with bit 8: `3` solid except Boy/Dog, `5` solid for the Dog, `7` solid for Boy and Dog, `8` hides a character standing there |
| 12 | sprite in front | the character standing here is drawn over the canopy (`$8FC773`); 84% of tiles |
| 13 | always walkable | geometry forced open; bits 3..0 become drift / stair shear (`$8FADB2`/`$8FADD1` for diagonal stairs) |
| 14 | **step-on trigger cell** | the step-on table is only searched while the player stands on a bit-14 tile (`$8FB078`: `BIT #$4000` → `JSL $8FACB1`); elsewhere the current trigger `$2429` is reset to `$FFFF` |
| 15 | interact | B searches the B-trigger table instead of swinging (`$8FCE43`) |

**Bit 14, measured:** 4878 of the 4895 bit-14 cells in vanilla lie inside a
step-on box, and 1095 of 1205 boxes contain one. A step-on box with no bit-14
cell never fires by walking onto it. Anything that writes or moves step-on
triggers must set bit 14 under them. The editor treats it like Interact: the
Special tab's Step-on group, a Step-on overlay, and a check on the Info tab.

Entities collide with each other by a separate rule (`docs/script-format/hitboxes.md`).

---

## 10. Triggers

Both tables: 6-byte records `[y1][x1][y2][x2][script:2]`, coordinates in **cells
plus the header origin**, 8-bit, **far edge exclusive**:
`y1 ≤ cellY + originY < y2` and the same for X (`$8FACEF..$8FAD08`). `script` is a
byte offset into the script pointer table (multiples of 3).

| | Step-on | B-trigger |
|---|---|---|
| WRAM | `$1062` len, `$1064` table | `$1067` len, `$1069` table |
| Fires when | the player stands in the box **on a bit-14 cell** and the box's script differs from the last one (`$2429`) | B is pressed on a **bit-15** cell (`$8FCE43`); the test point is moved toward the facing (`$8FAC84`, `JSR ($C3FF,X)` with `$10`: read from the code, not traced) |
| Typical script | doors (`CHANGE MAP`), cutscenes | gourds, chests, signs, NPC talk |

The editor converts records to inclusive map cells (`collision-overlay.ts`,
`mapCellBox`). Custom-map export writes no triggers yet.

---

## 11. What is *not* in the blob

| Thing | Where it really is |
|---|---|
| **Entrances** | Nowhere in the destination room. An entrance is a `CHANGE MAP` (`0x22`, `[x>>3][y>>3][room:16]`, 8px units) in some *other* room's trigger script. `src/script/arrivals.ts` walks every room's triggers and indexes them by destination (605 transitions); the arrow comes from the "Prepare room change? South exit…" call. `docs/script-format/arrivals.md`, `map_transitions.md` |
| **Enemies, NPCs** | placed by the room's **enter script** (`add_enemy` opcodes `0x3C/0xBA/0xA2/0xC2`); every branch is a candidate. `docs/script-format/entities-reference.md` |
| **Music, story state** | enter and trigger scripts |
| **Widgets, groups, levels, specials, the Boy's start** | editor concepts: `docs/map-format/editor-concepts.md` |

---

## 12. Located but not fully understood

| Field | What is known | What is not |
|---|---|---|
| CHR descriptors | slot group, entry, graphic id; reserved by `$90D50F` | what draws with them; the editor shows nothing and custom maps copy the donor's |
| Families past the 7th | alternate sets switched by `MAP_PALETTE`; previewed on the Info tab's Header sub-tab | the draft keeps only the first 7; sets cannot be edited |
| cuttable `steps` byte | always 1 | meaning |
| duplicate cuttable sources | exist in 4 rooms | which record the engine uses |
| gate nibble 1/9, Deflect | no passability effect (`map_collision_mechanics.md` §4) | the editor's "Deflect" reading is unconfirmed in game |
| `$90A3AC` (no-hold stepping) | taken for bit-15 values or `$0106` bit 7 | which scripts use it |

---

## 13. Re-measuring

The numbers above came from Node one-liners over `src/maps/dist/` and the vanilla
ROM (`../everscript/Secret of Evermore (U) [!].smc`, `EVERSCRIPT_ROM` in tests).
Pattern:

```js
const { decodeRoom } = require('./src/maps/dist/room');
const { parseBlobLayout } = require('./src/maps/dist/blob-layout');
const rom = new Uint8Array(require('fs').readFileSync(ROM));
for (let id = 0; id < 127; id++) { const r = decodeRoom(rom, id); /* … */ }
```

For engine questions, disassemble the routine named here from the ROM (HiROM:
file offset = `snes - 0x800000` for banks `$80..$BF`; `$C0..$FF` minus
`0xC00000`) and track the M/X flags across `REP`/`SEP`. That is how §8's `hold`
and §9's bit 14 were settled.
