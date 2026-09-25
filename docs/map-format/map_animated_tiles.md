# Secret of Evermore: Animated Map Tiles (Section 2)

> Status: format solved and implemented. Decoder in
> `everscript-vscode/src/maps/animation.ts`, pinned by `checkAnimation` in
> `tests/memory/map-parity.test.js`.
>
> This supersedes §7 of [map_tile_graphics_decompression.md](map_tile_graphics_decompression.md),
> which had the right shape but two wrong details — both corrected below and
> both verified against every room in the ROM.

---

## 1. What they are

95 of the 127 vanilla rooms animate part of their background: running water,
lava bubbles, torch flames, rotating fans, guard faces, light beams, stone wall
mechanisms. 1020 animation **channels** across those rooms.

A channel does not move anything. It swaps the *graphic* loaded into one VRAM
slot on a timer. The tilemap never changes — the same metatile keeps pointing
at the same slot — so animation is invisible to collision, to objects, and to
everything else that reads the grid.

| Question | Answer |
|---|---|
| How many things can animate in one room? | One channel per animated graphic; 1 to 32 in practice. The V-Blank DMA budget is the real ceiling (see [map_editor_architecture_and_limitations.md](map_editor_architecture_and_limitations.md) §2). |
| Where do the frames live? | Section 2 of the room blob, right after Block 1's payload. |
| Do channels share a clock? | **No.** Each has its own frame delays and runs free. |
| Does animation affect collision? | No. It replaces graphics in a VRAM slot, not metatile IDs in the grid. |

---

## 2. Binary layout

Section 2 sits at `block1.offset + 2 + block1.payloadLen`.

```
[count : 1]                      number of channels
[len   : 2]                      little-endian; EXCLUDES these 3 header bytes
count x [delay : 1]              initial countdown
        [frames: 1]              number of frames in this channel
        [offset: 2]              little-endian, relative to the descriptor table
[0xFF]                           ends the DESCRIPTOR TABLE
frame data:
  [delay : 1][tileId : 2] ...    one entry per frame, little-endian tile id
```

Three things that are easy to get wrong:

1. **`offset` is relative to the descriptor table** — that is, to Section 2 + 3,
   not to Section 2 itself. The first channel's offset therefore equals
   `count * 4 + 1`: past the table and past the `0xFF`.
2. **Channel `i` owns the frames from its own offset up to channel `i+1`'s.**
   The last channel runs to `len`. Channels are contiguous and ascending.
3. **Frame data has no terminator.** The lone `0xFF` ends the descriptor table.

### Corrections to the earlier write-up

| Earlier claim | Reality |
|---|---|
| The second descriptor byte is a `timer` | It is the channel's **frame count** |
| Frame streams are `0xFF`-terminated | The `0xFF` ends the **descriptor table**; frame data is bounded by `len` |

The second one bites: a tile id whose low byte is `0xFF` looks exactly like a
terminator. Reading it that way made 686 of 1020 channels appear malformed.

### Verified across all 127 rooms

| Invariant | Result |
|---|---|
| First channel's offset equals `count * 4 + 1` | 95 / 95 rooms |
| Offsets strictly ascending | 1020 / 1020 channels |
| Byte span divisible by 3 | 1020 / 1020 channels |
| Byte span equals `frames * 3` | 1020 / 1020 channels |
| Last channel ends exactly at `len` | 95 / 95 rooms |
| Frame 0's tile id equals what the tile palette already used | 1020 / 1020 channels |

---

## 3. Worked example — room 0x71

```
+0x00: 02 1b 00                    count = 2, len = 0x1B
+0x03: 00 04 09 00                 chan 0: delay 0, 4 frames, offset 0x09
+0x07: 00 02 15 00                 chan 1: delay 0, 2 frames, offset 0x15
+0x0B: ff                          end of descriptor table
+0x0C: 0a 40 07                    frame: hold 10 ticks, tile 0x0740   <- chan 0
       0a 41 07                           tile 0x0741
       0a 42 07                           tile 0x0742
       0a 43 07                           tile 0x0743
+0x18: 08 6b 07                    frame: hold 8 ticks, tile 0x076B    <- chan 1
       08 6c 07                           tile 0x076C
```

Channel 0's offset `0x09` resolves to `section2 + 3 + 0x09` = `+0x0C`, the first
byte after the `0xFF`. Channel 0 runs to channel 1's offset (`0x15`), giving four
frames; channel 1 runs to `len` (`0x1B`), giving two. Both match their declared
frame counts.

Channel 0 is the torch flame — `0x0740`–`0x0743` at 10 ticks each, about 6 Hz.

---

## 4. Palette extension

At room load the engine appends **frame 0** of each channel to the end of the
Block 1 tile palette in WRAM (`$7FC300`):

```
masterTile[k] = k <  len(block1Palette) ? block1Palette[k]
                                        : animatedFrame0[k - len(block1Palette)]
```

So a tilemap word whose palette slot lands past the Block 1 palette is an
animated cell, and `slot - len(block1Palette)` is its channel index. That is the
only link between the tilemap and Section 2, and it is how a renderer finds
which cells animate:

```ts
const slot = Math.floor(charIdx / 0x20) * 8 + Math.floor((charIdx % 0x20) / 2);
const channel = slot - room.tilePalette.length;   // >= 0 means animated
```

Frames are decompressed by the same `$8CC88C` routine as every other tile, and
streamed into VRAM by the V-Blank DMA queue at `$90A0D0..$90A1A0`.

---

## 5. Rendering animation outside the game

Notes from implementing this in the Rooms tab. None of it is ROM format, but
all of it is the difference between animation that works and animation that
quietly corrupts the view.

### Channels have no common period

Frame delays differ per channel, so the room's overall cycle is the LCM of the
channel periods — which is astronomically large in practice (the first attempt
at a global frame timeline overflowed a `Set`). **There is no whole-room frame
sequence.** Animate per channel, each on its own clock.

### An object state changes which channel drives a cell

A state descriptor XORs metatile IDs into the grid
([map_objects.md](map_objects.md) §4b), and the new metatile can resolve to a
different tilemap word — and therefore a different palette slot, and therefore
a different channel.

Room 0x25's firepit is the clean example: cells `(31,46)`–`(32,47)` run on
channels **6–9** unlit and **0–3** burning. Anything caching the animation
across a state change will replay the unlit frames over the lit tiles. Cache
animation on the same key as the render.

### Animation and annotation overlays collide

If a viewer draws collision contours, object boxes, trigger boxes or labels
into the rendered image, an animated cell can carry both. A frame drawn from a
bare composite will wipe that art wherever it lands.

Freezing the marked pixels is not the answer either — a 20% wall tint covers
72% of the pixels in 0x25, which would stop most of the room dead.

What works: measure what the overlay does to each pixel and re-apply it. Every
overlay pass is an alpha blend or an opaque write, so per channel the result is
affine in the base colour, `out = base*(1-a) + C*a`. Probing the overlay with a
flat black and a flat white image pins both unknowns exactly:

```
atZero = C*a                        (overlay over black)
atFull = 255*(1-a) + C*a            (overlay over white)
out    = base*(atFull - atZero)/255 + atZero
```

Both extremes fall out without a special case: an opaque write gives
`atZero == atFull` (correctly frozen), and an untouched pixel gives
`atZero = 0, atFull = 255` (a pure passthrough). Reproduces a real annotated
render to within 1 LSB of rounding.

### Payload

Rendering whole-room frames is impossible (no global cycle) and wasteful. The
Rooms tab instead groups animated cells by which channels drive them, splits
each group into 8×8-metatile blocks so the transparent padding stays bounded,
and emits one small PNG per block per frame. Cells sharing both tilemap words
render once — the median room has 22 unique pairs behind hundreds of cells.

Median cost is 43 KB and 28 blocks per room; the four heaviest rooms reach
roughly 900 KB.

---

## 6. Still open

**CGRAM colour cycling.** Some SNES games animate water by rotating palette
entries rather than swapping tile graphics. Nothing found so far suggests the
Evermore map renderer does this — every animation encountered is a Section 2
tile swap — but it has not been ruled out by tracing.

---

## 7. Related documentation

- [Map Tile Graphics Decompression](map_tile_graphics_decompression.md) — `$8CC88C`, the tile palette, and §7's original (partly incorrect) description
- [Map Objects](map_objects.md) — §4b, the XOR stamp format that can move a cell between channels
- [Map Rendering Pipeline](map_rendering_pipeline.md) — Mode 1 compositing the frames go through
- [Map Editor Architecture & Limitations](map_editor_architecture_and_limitations.md) — §2, the V-Blank DMA budget that caps animation per room

---

## In the map editor's tile list

`src/maps/vanilla-animation.ts` tallies every channel into the vanilla index.
Vanilla often runs **one cycle at several phases**: the Halls torches have
channels starting at 2742, 2743, 2744… that all cycle through 2742–2746. So an
animation is the cycle, whatever phase it starts at, named by its lowest
graphic. Across all rooms that gives 329 animations whose 636 later frames are
never placed on their own.

The Tile tab (`map-editor-tile-filters.js`):
- **`anim`** (the default) shows each animation once, as a swatch that plays
  its frames at vanilla's timing (delays are 60 Hz ticks), marked `▶n`.
- **`frames`** lists every frame as its own swatch, marked `k/n`.

Family-sheet slot rows carry `[13] kind` (1 frame 0, 2 later frame), `[14]`
frame 0 and `[15]` frame number. The sheet carries `animations` (frame 0 →
frames and delays), and the catalogue carries a `frames` count.

**Not done yet:** Export ROM writes no Section 2 for a custom map
(`maps/custom-room.ts`), so an animated tile painted there is its first frame,
standing still, in the game.
