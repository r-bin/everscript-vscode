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

  "tileFamilies": [105, 352, 324, 106, 353, 43, 60],   // 16-colour PALETTES (sec. 4)
  "extraGraphics": [],         // extra graphics slots loaded on top (sec. 4.3)
  "tileIds":      [489, 2648, /* ...122 entries... */], // the 16x16 graphics (Block 1)

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

### 3.1 Visible layers — what the bits mean

Written straight to `$212C`. One bit per layer; set = drawn.

| Bit | Value | Layer | In this game |
|---|---|---|---|
| 0 | `1` | BG1 | **the canopy** — what's drawn in front of the player |
| 1 | `2` | BG2 | **the terrain** — the floor |
| 2 | `4` | BG3 | the HUD / status text |
| 3 | `8` | BG4 | unused in Mode 1 |
| 4 | `16` | OBJ | sprites — player, enemies, NPCs |

So the usual `23` = `1+2+4+16` = canopy + terrain + HUD + sprites.

Useful combinations, and yes — you can do fancy things with these:

| Value | Effect |
|---|---|
| `23` | normal (126 of 127 rooms) |
| `22` | **canopy off** — terrain, HUD, sprites only. Room `0x4b` uses this, because its canopy is doing colour math instead (§3.2) |
| `21` | **terrain off** — the floor vanishes, canopy floats over the backdrop colour |
| `7` | **sprites off** — scenery only; the player is invisible |
| `19` | canopy + terrain + sprites, **no HUD** — a cutscene look |
| `0` | nothing on the main screen — a black room you can still walk around |

The catch: a layer that is off here is not merely hidden — it stops being a
main-screen layer, so it no longer covers anything and no longer takes part
in colour math as a main operand. Turning the canopy off to "see the floor"
also silently disables anything the canopy was blending.

### 3.2 The blend — three fields that only work together

SNES colour math is `result = main ± sub`, and it takes all three fields:

- **Blend layers** (`$212D`) — which layers form the **subscreen**, the
  right-hand operand. Same bit numbering as §3.1.
- **Blend mode** (`$2131`) — the operator, and which **main-screen** layers
  it applies to:

  | Bit | Value | Meaning |
  |---|---|---|
  | 0 | `1` | apply to BG1 (canopy) |
  | 1 | `2` | apply to BG2 (terrain) |
  | 2 | `4` | apply to BG3 |
  | 4 | `16` | apply to sprites |
  | 5 | `32` | apply to the backdrop |
  | 6 | `64` | **halve** the result |
  | 7 | `128` | **subtract** instead of add |

- **Blend rules** (`$2130`) — where it applies at all. `2` in every vanilla
  room.

Measured combinations:

| Blend mode | Rooms | What it is |
|---|---|---|
| `0` | 67 | no blending |
| `2` (`0x02`) | 34 | add the subscreen to the terrain |
| `66` (`0x42`) | 23 | add **at half intensity** to the terrain — soft glow |
| `65` (`0x41`) | 1 | half-add to the canopy (room `0x4d`) |
| `146` (`0x92`) | 2 | **subtract**, on the terrain and sprites (rooms `0x1d`, `0x4b`) |

#### Worked example: the dark cave lantern (room `0x4b`)

This is the one room where all three fields plus a room effect cooperate,
and it is worth reading as a unit:

```
visibleLayers = 22   -> canopy OFF the main screen; terrain, HUD, sprites on
blendLayers   = 1    -> the canopy IS the subscreen
blendMode     = 146  -> subtract (128) + terrain (2) + sprites (16)
roomEffect    = 1    -> offsets the canopy layer by (-352, -336) from the camera
```

The canopy layer is not a picture of scenery at all. Rendered on its own it
is **a soft-edged dark disc on a flat grey field**, covering only the
top-left 608×608 px of the room:

```
  ┌─────────────┐          grey  = high value  -> subtracted -> terrain goes dark
  │   ▓▓▓▓▓     │          black = low value   -> subtracted -> terrain unchanged
  │  ▓█████▓    │
  │  ▓█████▓    │   so the DARK disc is the part that stays LIT.
  │   ▓▓▓▓▓     │   It is a lantern, drawn as a hole in a mask.
  └─────────────┘
```

Every displayed pixel becomes `terrain − canopy`. Where the canopy is grey
the terrain is darkened; inside the disc the canopy is near-black, so almost
nothing is taken away and the floor stays bright. Room effect 1 then moves
that layer with the camera every frame, so the lit circle follows the
player.

**This was the reader's guess and it is correct**, with one refinement: the
circle is not "subtracted away" — it is the *rest* of the layer that
subtracts, and the circle is where subtraction stops. In a static render the
effect sits in the top-left corner because nothing is scrolling the layer, so
you see a bright disc inside a darkened square and untouched terrain outside
it — that corner square is the whole extent of the layer's data.

### 3.3 Room effects

`roomEffect` indexes a jump table at `$908E74`, called every frame from
`$9092BC`. What each one actually does:

| Value | Routine | Does | Used by |
|---|---|---|---|
| `0` | `$909A81` | Baseline: zeroes the two layer scroll offsets `$7E2417`/`$7E2419`, so both layers track the camera 1:1. | 118 rooms |
| `1` | `$909AAA` | Offsets one layer by **(−352, −336)** from the camera, so it slides independently — the lantern mask in §3.2. | `0x4b` |
| `2` | `$909B3B` | Zeroes the offsets but writes a different value to `$7E22FA/FB`, and separately changes **sprite depth sorting** (`$8FC7E8` treats effect 2 specially, sorting plane-0 entities by distance from `$010E/$0110`). | `0x22 0x31 0x38 0x41 0x5b 0x6a` |
| `3` | `$909B58` | Same shape as 2 with another `$7E22FA/FB` value. | no vanilla room |
| `4` | `$909BFF` | Sets `$0FAC = 0x1C` and drives tables at `$151A`/`$153E`. | `0x1d` |
| `5` | `$909C33` | Sets `$0FAC = 0x20`, then repeatedly writes BG1 and BG2 horizontal scroll (`$210D`/`$210F`) from a table — a per-line horizontal displacement, i.e. a wave. | `0x52` |
| `6`, `7` | `$907BAA`, `$9080A8` | In the table but unused by any vanilla room. | — |

**Use `0`** unless you want one of the above.

### 3.4 Camera flags

16 bits at header `+9..+10`, stored to `$0F84`. Exactly one bit is read
anywhere in the ROM:

| Bit | Value | Effect |
|---|---|---|
| 14 | `0x4000` | At `$909ECC`: if the camera's Y is below `focusY − 96`, it is pulled up to exactly that. The focus point `$0617` is written at `$8EA0F5` as the followed entity's Y minus 13. In practice: **the camera follows the player upward more tightly**, so he can't sink toward the bottom of the screen. |
| all others | — | never read |

`0` in all 127 vanilla rooms, so this is a capability the shipped game never
used. Setting `0x4000` is legal and does the above; anything else is
identical to `0`.

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

## 4. What the room loads: palettes, graphics, budgets

### 4.1 `tileFamilies` are **palettes**, not graphics

`105` is not a graphics bank. Each tile family is a **16-colour palette**, a
32-byte BGR555 record at `$9CC322 + familyId * 32`, DMA'd into CGRAM by the
loader at `$90D020`.

They are assigned to background palette slots **in list order**:

```
tileFamilies[0] -> CGRAM background palette 1
tileFamilies[1] -> CGRAM background palette 2
...
tileFamilies[6] -> CGRAM background palette 7      (palette 0 is the HUD's)
```

A tilemap word's 3-bit palette field (bits 10–12) picks among them. So the
same graphic drawn with palette 1 and palette 4 is the same shape in
different colours — which is exactly how the game gets so much variety out
of so few tiles.

**The loader clamps the count to 7** (`$90D037: CMP #$0008 / BMI / LDA
#$0007`), and tracks how many it has already done in `$7E2437`, so a room
listing more than 7 has them loaded **seven at a time**. That is why the
counts cluster the way they do:

| Families listed | Rooms |
|---|---|
| 1–6 | 31 |
| **7** | **74** |
| 8 | 3 |
| 12 | 1 |
| **14** | **18** |

74 rooms fill all seven slots exactly; 18 list fourteen — two complete sets,
swapped at runtime.

### 4.2 How many can you have before you run out?

The premise of "how many tile families until VRAM is full" doesn't apply,
because families never touch VRAM — they're CGRAM. The real ceilings:

| Resource | Limit | Why |
|---|---|---|
| **Background palettes** | **7** | Palette slots 1–7; slot 0 belongs to the HUD. The loader hard-clamps to 7 per load. |
| **Graphics per room** (Block 1) | ~**264** | A word's `chr` field is 10 bits, and `chr` → slot is `floor(chr/32)*8 + floor((chr%32)/2)`, so slots 0–263 are reachable. The fullest vanilla room uses **246**. |
| **Distinct stamps** (Block 3) | ~2131 observed | No hard field limit found; the practical cap is the WRAM window (§7.3). |
| **Animated graphics** | ~4–8 | V-blank DMA bandwidth, not a field. See [map_animated_tiles.md](map_animated_tiles.md). |

So a room's visual vocabulary is **up to ~264 graphics × 7 palettes**, and
the Rooms tab now shows exactly which graphics a given room loaded — open
the *Tile palette* section and switch to **graphics**. Each swatch's tooltip
gives the `chr` value a tilemap word needs in order to draw it.

### 4.3 `extraGraphics`

Three bytes each, read at `$9090A6` and handed to `$90D50F`:

| Byte | Bits | Meaning |
|---|---|---|
| 0 | 4–6 | slot group — `(b & 0x70) >> 3`, so an even index into a table of 2-byte entries |
| 0 | 0–3 | entry within that group |
| 1–2 | — | a 16-bit graphic id, little-endian |

`$90D50F` uses them to look up and reserve entries in slot tables at
`$13D2`/`$1372`/`$13F2`/`$13B2`. They load additional graphics on top of
what Block 1 already brought in. **71 of 127 rooms have none**; the rest
have 1–8. Room `0x00`, for instance, has three: `[4d 03 04]`, `[51 04 08]`,
`[56 04 08]`.

Use `0` for a new room — everything in this walkthrough is drawn without
them.

## 5. The three tiles used in this walkthrough

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

## 6. The five rooms

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
   The "over" layer is **BG1**, which Mode 1 draws above BG2 at equal
   priority — so the canopy is BG1 and the terrain is BG2, not the other
   way round.
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

## 7. The three rules that will bite you

These are not theory. Each one broke a build while writing this page.

### 7.1 Borrow a whole tile set, never a single entry

**Symptom:** the room decodes perfectly and renders solid black.

The `under` word `0x302C` asks for character 44. `charIndexToPaletteSlot(44)`
resolves to **slot 14** of the room's tile list. If your tile list has one
entry, slot 14 doesn't exist, and the renderer silently falls back to tile 0.
Nothing reports an error, because a short list isn't malformed — it just
means something else.

**Rule:** copy the `tileFamilies` **and** the full `tileIds` list from
whichever room your stamp words came from. Don't assemble them from parts.

### 7.2 Introduce stamps roughly in order — the precise rule

**Symptom:**

```
ValueError: metatile 0x0030 (index 2) does not fit the 0-bit literal field
at cell 0; the grid must introduce metatiles in ascending order
```

The error message says "ascending order", and ordering by first appearance
always works — but that is the safe advice, not the actual rule. **Is it a
hard rule? Partly.** Here is what the compressor really does.

The grid stream has a *sequential* token that means "the next stamp you
haven't used yet". Each time it fires, a counter advances, and the width of
the **literal index field** grows with it:

```
counter: 1  2  3  4  5  6  7  8 ...
bits:    1  2  2  3  3  3  3  4 ...        bits = floor(log2(counter)) + 1
```

A literal reference to stamp *n* is legal iff `n < 2^bits`. So:

- **Cell 0 must be stamp 0.** The field starts 0 bits wide, and the only
  index that fits is 0.
- **Gaps are allowed** once the field is wide enough. After introducing
  0, 1, 2 the field is 2 bits, so stamp 3 can be referenced even though it
  was never introduced sequentially.
- **Big jumps fail.** Stamp 5 right after stamp 0 does not fit a 1-bit
  field.

Verified directly against the encoder:

| Grid (stamp indices) | Result |
|---|---|
| `0, 1, 2, 3` — 3 never introduced | **OK** (3 fits the 2-bit field) |
| `0, 1, 2, 3, 4, 5, 7, …` | **OK** |
| `0, 1, 0, 1` | **OK** |
| `1, 0, 0, 0` — starts at 1 | **fails** — 0-bit field at cell 0 |
| `0, 5, 0, 0` — jumps to 5 | **fails** — 1-bit field at cell 1 |

This is also why vanilla rooms can have **7591 stamps that are defined but
never placed**: they sit in gaps below the width the sequential
introductions already unlocked.

**Rule of thumb:** order by first appearance and you will never hit this.
Build the dictionary from the grid, not the other way round:

```python
order = []                       # first-appearance order
for cell in cells:
    if cell not in order:
        order.append(cell)
index = {name: i for i, name in enumerate(order)}
grid  = [base + index[c] * 8 for c in cells]
```

### 7.3 Stamp numbers are byte offsets, and they move when you resize

A grid cell stores `base + stampIndex * 8`, where **`base = columns × rows × 2`**.

The dictionary lives in memory immediately after the grid, so its starting
address depends on the room's size. **Change the width or the height and
every stamp number in the grid changes.** Resizing is: recompute `base`,
rewrite every cell, re-encode. It is never a crop.

---

## 8. The optional sections, with examples

All four are legitimately empty for a new room. Each is named here so
nothing in the blob is a mystery, with a real vanilla record to copy if you
do want one.

For a new room, all of these are legitimately zero. Each is named here so
nothing in the blob is a mystery:

| Section | Empty value |
|---|---|
| **extraGraphics** (§4.3) | count `0` |
| **animatedTiles** (Section 2) | count `0`, length `0` |
| **objects** (Section 3 + object area) | count `0`, empty area |
| **grassSwaps** (Section 4) | length `0` |

### 8.1 An animated graphic

Section 2 lists graphics whose pixels are swapped during v-blank — water,
lava, torches. Each descriptor names a **channel**: a list of graphic ids
to cycle through, and how long to hold each.

The decoder already reads them (`room.animation`), and the ones a room has
are appended to the tile list after Block 1's entries — which is why
`tileIds` and "graphics" in the Rooms tab can be longer than Block 1 alone.
In the tab's **graphics** view an animated entry is outlined in amber.

Vanilla rooms use **0–42 channels, median 4**. The ceiling is not a field
but v-blank DMA bandwidth: roughly 4–8 animated graphics is the safe budget
([map_animated_tiles.md](map_animated_tiles.md) has the transfer maths).

A real channel, from room `0x25` (its firepit):

```jsonc
"animatedTiles": [
  { "index": 0, "delay": 0, "frames": [
      { "tileId": 3412, "delay": 8 },
      { "tileId": 3413, "delay": 7 },
      { "tileId": 3414, "delay": 8 },
      { "tileId": 3415, "delay": 7 },
      { "tileId": 3413, "delay": 8 }     // frames may repeat
  ]}
]
```

Each frame carries **its own hold time**, so a cycle can be uneven — this
one alternates 8 and 7 frames. Room `0x25` has 12 such channels.

For a new room: leave it empty. An animated tile that overruns the DMA
budget does not fail cleanly — it tears or drops frames.

### 8.2 An object

Section 3 objects are **stamps applied at runtime**, each with several
states: a chest closed and open, a bridge extended and retracted, a gourd
whole and smashed. The object record holds, per state, a position and a
pointer to a small rectangle of stamp numbers to paste there.

A real one, object 0 of room `0x25`:

```jsonc
"objects": [
  {
    "objectIndex": 0,
    "maxState": 1,              // stateCount = maxState + 1 = 2
    "states": [
      { "state": 0, "tileX": 27, "tileY": 13, "targetWidth": 2, "targetHeight": 2,
        "metatileId": 126 }
    ]
  }
]
```

The surprise is **how** a state changes the map. The record a state points
at is not a rectangle of stamp numbers — it is a rectangle of **XOR
deltas**:

```jsonc
parseObjectStamp(rom, objectArea, 126)
// { tw: 2, th: 2, deltas: [6240, 6240, null, 7960], tileCount: 3, valid: true }
```

State *n* is reached by XOR-ing the deltas of states *1…n* into the grid, so
state 0 is simply "the room as loaded" and every later state is a diff.
`null` means "leave this cell alone", which is why a 2×2 stamp can touch
only 3 cells.

Because the result is still a **stamp number**, collision follows the
artwork for free — the stamp that lands carries its own collision word, so
a bridge that appears is walkable the instant it is drawn. That is the
bundling rule from §1 working in your favour for once.

Vanilla rooms have **0–72 objects, median 8**; past ~45 you risk overflowing
the object area. See [map_objects.md](map_objects.md).

### 8.3 Cuttable grass

Section 4 is a swap table: *when the player slashes the stamp at this grid
position, replace it with that stamp.* Its records are pairs of stamp
numbers, driven by `$90A6EF`.

A real table, from room `0x36`:

```jsonc
"grassSwaps": {
  "preRegisteredStamps": 0,
  "sourceCount": 5,
  "records": [
    { "source": 1250, "steps": 1, "sequence": [3242] },
    { "source": 1258, "steps": 1, "sequence": [3250] },
    { "source": 1266, "steps": 1, "sequence": [3258] }
    // ...5 in all
  ]
}
```

`source` is the stamp that can be cut and `sequence` is what it becomes.
`steps` is the length of that sequence — **more than one means grass that
takes several slashes**, each moving it one stage along. Room `0x36` has 5
cuttable source stamps covering 17 grid positions.

Its **first byte is doing double duty** and is worth knowing about even if
you never use cuttable grass: `preRegisteredStamps` seeds the grid
compressor's counter (§7.2). A non-zero value means "pretend this many
stamps have already been introduced", which starts the literal index field
wider. It is `0` in 120 of 127 rooms, and **your new room should use `0`** —
`encode_block2(..., fc4=0)`.

See [cuttable_grass_mechanics.md](cuttable_grass_mechanics.md).

---

## 9. The full build, end to end

```python
def build(columns, rows, cells, stepOn=(), buttons=()):
    # 1. dictionary ordered by first appearance (rule 7.2)
    order = []
    for c in cells:
        if c not in order: order.append(c)
    index  = {n: i for i, n in enumerate(order)}
    stamps = [STAMPS[n] for n in order]

    # 2. stamp numbers are offsets past the grid (rule 7.3)
    base = columns * rows * 2
    grid = [base + index[c] * 8 for c in cells]

    model = RoomModel(
        header = bytes([0, 0, columns, rows, 23, 0, 0, 2, 0, 0, 0, 0, 0]),
        step_on = list(stepOn), b_trigger = list(buttons),
        tile_families = FAMILIES,            # borrowed whole (rule 7.1)
        extras = b"",
        block1 = encode_block1(TILE_IDS),    # borrowed whole (rule 7.1)
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
