# Building a room from scratch

A hands-on walkthrough: five rooms, each one step harder than the last, every
one of them built, written into a ROM, read back and rendered to check it
came out right. No field in this page is described as "unknown" — where the
meaning wasn't already written down it was traced in the ROM, and the
routine that reads it is named.

> Every room on this page is built by
> [`examples-build-rooms.py`](examples-build-rooms.py), which is what this
> page was written from — run it to reproduce all five. Companion pages:
> [map_editor_ui.md](map_editor_ui.md) for the interactive editor,
> [map_encoding.md](map_encoding.md) for the compression formats.

---

## 1. The idea in one picture

A room is **not** a bitmap. It is a **dictionary of stamps** plus a **grid of
references**:

```
   DICTIONARY (Block 3)                 GRID (Block 2)
   ┌───┬──────────┬──────────┬────────┐  ┌───┬───┬───┬───┐
 0 │ 🟩│ nothing  │ grass    │ walk   │  │ 0 │ 1 │ 0 │ 0 │
 1 │ 🟫│ nothing  │ dirt     │ walk   │  │ 0 │ 1 │ 0 │ 0 │
 2 │ 🌿│ leaves   │ grass    │ walk   │  │ 2 │ 2 │ 2 │ 2 │
   └───┴──────────┴──────────┴────────┘  │ 0 │ 1 │ 0 │ 0 │
        ▲          ▲          ▲          └───┴───┴───┴───┘
     drawn over  drawn under  can you
     the player  the player   walk here?
```

Every grid cell holds one **stamp number**. Every stamp bundles **three
things that cannot be separated**: what's drawn behind the player, what's
drawn in front of the player, and whether the player can walk there.

That bundling is the single most important fact in this document. It is why
Level 2 below costs you a whole extra dictionary entry to change *nothing
but* the collision.

---

## 2. The blob, as JSON

This is the complete structure of a room. Everything a room is, is in here:

```jsonc
{
  "header": {
    "triggerOriginX":  0,      // where trigger rectangles count from, in tiles
    "triggerOriginY":  0,
    "columns":         4,      // room width  in 16x16 tiles
    "rows":            4,      // room height in 16x16 tiles
    "visibleLayers":  23,      // which layers are drawn at all
    "blendLayers":     0,      // which layers feed the transparency blend
    "blendMode":       0,      // how the blend combines them
    "blendRules":      2,      // where the blend applies
    "roomEffect":      0,      // per-room screen effect (0 = none)
    "cameraFlags":     0,      // 16-bit; only bit 14 does anything
    "reserved":        0       // 16-bit; the loader steps over it
  },

  "stepOnTriggers": [          // fire when the player walks in
    { "x1": 1, "y1": 0, "x2": 2, "y2": 4, "scriptId": 4660 }
  ],
  "buttonTriggers": [],        // fire when the player presses B inside

  "tileFamilies": [105, 352, 324, 106, 353, 43, 60],   // graphics banks -> VRAM
  "extraGraphics": [],         // extra banks loaded on top (see 6.3)
  "tileIds":      [489, 2648, /* ...122 entries... */], // Block 1

  "animatedTiles": [],         // Section 2

  "objects": [],               // Section 3 + object area

  "grassSwaps": { "preRegisteredStamps": 0, "records": [] },  // Section 4

  "stamps": [                  // Block 3 - the dictionary
    { "over": 43008, "under": 1058,  "collision": 16 },
    { "over": 43008, "under": 12332, "collision": 16 },
    { "over": 12358, "under": 1058,  "collision": 16 }
  ],

  "grid": [                    // Block 2 - stamp number per cell
    [0, 1, 0, 0],
    [2, 2, 2, 2],
    [0, 1, 0, 0],
    [0, 1, 0, 0]
  ]
}
```

On disk the sections appear in a fixed order, each carrying its own length so
the whole chain can be walked without searching:

```
header[13] │ stepOn │ buttonTriggers │ tileFamilies │ extraGraphics
           │ Block1 │ animatedTiles  │ objectIndex  │ Block2
           │ grassSwaps │ Block3 │ objectArea
```

---

## 3. The header, field by field

13 bytes. The loader is **`$908F60`**; every claim below is what that routine
actually does with the byte.

| # | Friendly name | What it does | Use this |
|---|---|---|---|
| 0 | **Trigger origin X** | Trigger rectangles are stored relative to this, in tiles. Goes to `$0F86`. | `0` |
| 1 | **Trigger origin Y** | Same, vertically. Goes to `$0F88`. | `0` |
| 2 | **Columns** | Room width in 16×16 tiles. Also sets the camera's right limit (`width×16 − 256`). | your width |
| 3 | **Rows** | Room height in tiles. Sets the camera's bottom limit (`height×16 − 224`). | your height |
| 4 | **Visible layers** | Written straight to the PPU main-screen register `$212C`. `23` = `0b10111` = background layers 1, 2, 3 and sprites all on. | `23` |
| 5 | **Blend layers** | Written to `$212D`. Which layers go on the *subscreen*, i.e. act as the second operand for transparency. `0` = no blending. | `0` |
| 6 | **Blend mode** | Written to `$2131`. Add / subtract / half-intensity, and which layers take part. `0` = off. | `0` |
| 7 | **Blend rules** | Written to `$2130`. Where blending applies. **Every one of the 127 rooms uses `2`.** | `2` |
| 8 | **Room effect** | Stored at `$7E241F`. Used as a jump-table index at `$9092BC` (`LDA $7E241F; ASL; TAX; JSR ($8E74,X)`) — a per-room routine that runs every frame. Value `2` *also* changes how sprites are depth-sorted, in `$8FC7E8`. | `0` |
| 9–10 | **Camera flags** (16-bit) | Stored at `$0F84`. Exactly one bit is read anywhere in the ROM: at `$909ECC`, **bit 14** pulls the camera down to `focusY − 96` whenever it sits below that, i.e. it follows the player upward more tightly. | `0` |
| 11–12 | **Reserved** (16-bit) | The loader advances past these two bytes without reading them (`INY/INY` at `$90904D`, next read is the trigger length at +13). | `0` |

**Defaults, measured across all 127 vanilla rooms** — so `23 / 0 / 0 / 2 / 0`
isn't a guess, it's the overwhelming norm:

| Field | Distribution |
|---|---|
| Visible layers | `23` in 126 rooms, `22` in 1 |
| Blend layers | `0` in 67, `17` in 32, `1` in 26, other in 2 |
| Blend mode | `0` in 67, `2` in 34, `66` in 23, other in 3 |
| Blend rules | `2` in **all 127** |
| Room effect | `0` in 118; `2` in 6 (rooms `0x22 0x31 0x38 0x41 0x5b 0x6a`); `1`, `4`, `5` once each |
| Camera flags | `0` in **all 127** |
| Reserved | `0` in **all 127** |

---

## 4. The three tiles used in this walkthrough

Rather than invent tile numbers, all five rooms borrow real, in-use stamps
out of room `0x76` (the jungle), so the pictures are guaranteed to be
exactly what the game draws there.

| Name | Over (layer 1) | Under (layer 2) | Looks like |
|---|---|---|---|
| **grass** | `0xA800` (blank) | `0x0422` | green grass |
| **dirt** | `0xA800` (blank) | `0x302C` | purple-brown earth with yellow flecks |
| **leaves** | `0x3046` | `0x0422` | grass with foliage hanging over it |

Two collision words are enough for the whole walkthrough:

| Name | Value | Meaning |
|---|---|---|
| **walk** | `0x0010` | elevation 1, shape "fully open" → walkable |
| **block** | `0x001F` | elevation 1, shape "fully solid" → blocked |

Checked directly rather than assumed:

```js
passability(0x0010, 1) // -> 0   OPEN
passability(0x001F, 1) // -> 15  SOLID
```

---

## 5. The five rooms

### Level 1 — the smallest room that works

2×2 tiles, one stamp, walkable everywhere.

```
┌───┬───┐      stamps: [ {over: blank, under: grass, collision: walk} ]
│ 0 │ 0 │      grid:   [[0,0],[0,0]]
├───┼───┤
│ 0 │ 0 │
└───┴───┘
```

```python
build(columns=2, rows=2, cells=["grass"]*4)
# -> 305 bytes, 1 metatile
```

Read back: every cell `0x0008`, every collision `0x0010`. Rendered: 32×32 px,
fully painted. **This is the floor of the format** — you cannot make a
smaller working room than one stamp and a grid that points at it.

### Level 2 — same picture, half of it solid

The interesting one. Left column must *look identical* but block movement.

```
┌───┬───┐      stamps: [ {over: blank, under: grass, collision: BLOCK},
│ 0 │ 1 │                {over: blank, under: grass, collision: walk } ]
├───┼───┤      grid:   [[0,1],[0,1]]
│ 0 │ 1 │
└───┴───┘       ▲   ▲
             blocked walkable - and they are the same picture
```

```python
build(columns=2, rows=2, cells=["grass_solid","grass","grass_solid","grass"])
# -> 312 bytes, 2 metatiles   (was 305 bytes, 1 metatile)
```

Read back:

```
under (what you see): [[0x0422, 0x0422],   <- identical, both columns
                       [0x0422, 0x0422]]
collision:            [[0x001F, 0x0010],   <- different
                       [0x001F, 0x0010]]
```

**What it cost:** the dictionary doubled, 1 → 2 stamps, for a change that is
invisible. That is the bundling rule from §1 charging its price. There is no
"collision layer" you could have edited instead — the only way to give two
cells different behaviour is to make them different stamps.

The trap: if you instead *edit* the collision of the one shared stamp, **both
columns turn solid**, because the grid cannot tell them apart. They are the
same number.

### Level 3 — two things that look different

4×4, with a dirt path down the second column.

```
┌───┬───┬───┬───┐   stamps: [ grass, dirt ]
│ 0 │ 1 │ 0 │ 0 │   grid:   four rows of [0,1,0,0]
│ 0 │ 1 │ 0 │ 0 │
│ 0 │ 1 │ 0 │ 0 │   -> 313 bytes, 2 metatiles
│ 0 │ 1 │ 0 │ 0 │
└───┴───┴───┴───┘
```

Nothing new conceptually — but note it costs **one byte more** than Level 2
while being four times the area. The grid compressor is very good at
repetition; what costs bytes is *distinct stamps*, not *map size*.

### Level 4 — something drawn in front of the player

Row 1 becomes leaves that the player walks *behind*.

```
┌───┬───┬───┬───┐   stamps: [ grass, dirt, leaves ]
│ 0 │ 1 │ 0 │ 0 │
│ 2 │ 2 │ 2 │ 2 │  <- leaves: "over" layer has real art
│ 0 │ 1 │ 0 │ 0 │
│ 0 │ 1 │ 0 │ 0 │   -> 322 bytes, 3 metatiles
└───┴───┴───┴───┘
```

Two independent things have to line up for "walks behind" to actually happen:

1. The stamp's **over** word must have real art (`0x3046`, character 70 —
   not the blank `0xA800`) **and** its priority bit set (`0x3046 & 0x2000`).
2. The **collision word's bit 12 must be clear**. `$8FC773` reads the
   collision of the tile the player stands on; bit 12 set means "draw the
   player in front of everything." `walk` = `0x0010` has it clear, so the
   player goes behind. See [sprite_priority.md](../script-format/sprite_priority.md).

Get (2) wrong — use `0x1010` instead of `0x0010` — and the leaves render but
the player walks over the top of them.

### Level 5 — a trigger

Same room, plus a step-on trigger covering the dirt path.

```python
stepOnTriggers = [{"x1": 1, "y1": 0, "x2": 2, "y2": 4, "scriptId": 0x1234}]
# -> 328 bytes
```

Read back exactly: `{y1: 0, x1: 1, y2: 4, x2: 2, script_id: 4660}`.

Triggers are the easiest thing in the whole format — a flat array of 6-byte
records, `y1 x1 y2 x2` then a 16-bit script id, with a 16-bit count in front.
No compression, no cross-references.

**Size recap:**

| | Stamps | Bytes |
|---|---|---|
| L1 2×2, 1 stamp | 1 | 305 |
| L2 2×2, + collision variant | 2 | 312 |
| L3 4×4, + second look | 2 | 313 |
| L4 4×4, + canopy | 3 | 322 |
| L5 4×4, + trigger | 3 | 328 |

(~300 of those bytes are the borrowed 122-entry tile list from §6.1 — the
map content itself is tiny.)

---

## 6. The three rules that will bite you

These are not theory. Each one broke a build while writing this page.

### 6.1 Borrow a whole tile set, never a single entry

**Symptom:** the room decodes perfectly and renders solid black.

The `under` word `0x302C` asks for character 44. `charIndexToPaletteSlot(44)`
resolves to **slot 14** of the room's tile list. If your tile list has one
entry, slot 14 doesn't exist, and the renderer silently falls back to tile 0.
Nothing reports an error, because a short list isn't malformed — it just
means something else.

**Rule:** copy the `tileFamilies` **and** the full `tileIds` list from
whichever room your stamp words came from. Don't assemble them from parts.

### 6.2 Introduce stamps in the order the grid first uses them

**Symptom:**

```
ValueError: metatile 0x0030 (index 2) does not fit the 0-bit literal field
at cell 0; the grid must introduce metatiles in ascending order
```

The grid compressor grows its index field as new stamps appear. Stamp *n*
cannot be referenced before stamps *0…n−1* have been. So the dictionary must
be sorted by **first appearance in reading order**.

**Rule:** build the dictionary from the grid, not the other way round:

```python
order = []                       # first-appearance order
for cell in cells:
    if cell not in order:
        order.append(cell)
index = {name: i for i, name in enumerate(order)}
grid  = [base + index[c] * 8 for c in cells]
```

### 6.3 Stamp numbers are byte offsets, and they move when you resize

A grid cell stores `base + stampIndex * 8`, where **`base = columns × rows × 2`**.

The dictionary lives in memory immediately after the grid, so its starting
address depends on the room's size. **Change the width or the height and
every stamp number in the grid changes.** Resizing is: recompute `base`,
rewrite every cell, re-encode. It is never a crop.

---

## 7. The sections you can leave empty

For a new room, all of these are legitimately zero. Each is named here so
nothing in the blob is a mystery:

| Section | What it is | Empty value |
|---|---|---|
| **extraGraphics** | Extra graphics banks loaded on top of the tile families. Three bytes each: bits 4–6 of byte 0 pick a slot group, bits 0–3 an entry within it, bytes 1–2 are a 16-bit graphic id. Handed to `$90D50F`. 71 of 127 rooms have none. | count `0` |
| **animatedTiles** (Section 2) | Tiles whose graphics are swapped during v-blank — water, lava, torches. See [map_animated_tiles.md](map_animated_tiles.md). | count `0`, length `0` |
| **objects** (Section 3 + object area) | Chests, gourds, bridges — stamps applied at runtime with multiple states. See [map_objects.md](map_objects.md). | count `0`, empty area |
| **grassSwaps** (Section 4) | Cuttable grass: which stamp each grass tile turns into when slashed. Its first byte, `preRegisteredStamps`, also seeds the grid compressor — it reserves that many dictionary entries before the grid stream starts. `0` in 120 of 127 rooms. | length `0` (implies `0`) |

---

## 8. The full build, end to end

```python
def build(columns, rows, cells, stepOn=(), buttons=()):
    # 1. dictionary ordered by first appearance (rule 6.2)
    order = []
    for c in cells:
        if c not in order: order.append(c)
    index  = {n: i for i, n in enumerate(order)}
    stamps = [STAMPS[n] for n in order]

    # 2. stamp numbers are offsets past the grid (rule 6.3)
    base = columns * rows * 2
    grid = [base + index[c] * 8 for c in cells]

    model = RoomModel(
        header = bytes([0, 0, columns, rows, 23, 0, 0, 2, 0, 0, 0, 0, 0]),
        step_on = list(stepOn), b_trigger = list(buttons),
        tile_families = FAMILIES,            # borrowed whole (rule 6.1)
        extras = b"",
        block1 = encode_block1(TILE_IDS),    # borrowed whole (rule 6.1)
        section2_count = 0, section2_data = b"",
        object_offsets = [],
        block2 = encode_block2(grid, columns, rows, base, fc4=0),
        section4 = b"",
        block3 = encode_block3([s[0] for s in stamps],    # over
                               [s[1] for s in stamps],    # under
                               [s[2] for s in stamps]),   # collision
        object_area = b"",
    )
    return build_blob(model)
```

Then place it and point the game at it:

```python
rom[offset:offset+len(blob)] = blob
snes = 0x800000 | offset
entry = 0x1FFDE7 + room_id * 4          # file offset of the pointer table
rom[entry:entry+3] = snes.to_bytes(3, "little")
```

**Always read it back before trusting it.** Both of the first two rooms on
this page were wrong the first time — one rendered black, one refused to
encode — and in both cases decoding the result is what said so:

```python
d = dump_room(room_id, "patched.smc")
assert d["collision_words"] == expected
```
