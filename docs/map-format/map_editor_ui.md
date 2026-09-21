# Map editor: the UI, and what the ROM lets it offer

> Status: **drawing works.** The tile palette, a docked sidebar, five tools
> (paint / rect / pick / copy / move), undo, a metatile composer and a JSON
> draft export are shipped. The ROM write itself is not — the draft is the
> handover format, and §6 says where it plugs in. Everything else here is
> design.
>
> Companion pages: [map_editor_design.md](map_editor_design.md) decided it is
> a VS Code extension; [map_editor_architecture_and_limitations.md](map_editor_architecture_and_limitations.md)
> covers the hardware budgets; [map_editor_vscode_plan.md](map_editor_vscode_plan.md)
> covers repo placement and IPC. This page is about **what the user sees and
> clicks**, and which of it the format actually permits.

## 1. What a room is, from an editor's point of view

Four editable things, in increasing order of how dangerous they are to touch:

| | What | Where it lives | Risk |
|---|---|---|---|
| **A** | Trigger and object records | plain arrays in the blob | low — fixed-size records |
| **B** | The grid: which metatile is in each cell | Block 2, Markov | low — re-encodes cleanly |
| **C** | The dictionary: what a metatile *is* | Block 3, three slices | medium — grows the blob |
| **D** | Header: size, tile families, PPU registers | 13 bytes + the family list | high — see §5 |

The Rooms tab already **displays** all four. Turning display into editing is
mostly a matter of adding write paths in that order.

## 2. Which tiles can be placed? — the dictionary is the brush set

This is the question that decides the whole UI, and the answer is not "tile
families".

A grid cell stores a **metatile id**, and Block 3 turns that id into three
parallel words:

```
layer1[i]     Layer 1 (canopy / BG2) tilemap word
layer2[i]     Layer 2 (terrain / BG1) tilemap word
collision[i]  the collision word — geometry, plane, gates, sprite depth
```

So **a metatile is a whole vertical stack**, not a picture: two tilemap
words *and* the collision behaviour, bound together. `metatileCount` of them
per room, and **nothing outside that list can be placed** without extending
it.

Vanilla numbers, measured across all 127 rooms:

| | Min | Median | Max |
|---|---|---|---|
| metatiles defined per room | 2 | 503 | 2131 (room `0x37`) |
| of those, actually placed | 2 | 438 | 2038 |
| tile families | 1 | 7 | 14 |
| Block 1 tile ids | 2 | 133 | 246 |

**7591 of the 75203 defined metatiles are never placed.** Each is a free
slot: a new combination can go into one without growing Block 3 at all.
That number is worth showing in the UI, and the tab does.

### Tile families are one level below

A tile family is a compressed CHR bank loaded into VRAM. Families decide
which 8×8 characters *exist*; Block 1 picks a list of 16×16 tile ids out of
them; a tilemap word then names one of those plus a palette and flip bits.
So the chain is:

```
tile families  ->  VRAM characters
Block 1        ->  the room's tile-id list (the `chr` field of a word indexes it)
Block 3        ->  metatiles: two words + collision
Block 2        ->  the grid: which metatile per cell
```

An editor offers the **dictionary** as the brush set, shows the families as
the constraint behind it, and only touches families when the user wants
something the current banks cannot draw — which is a room-wide, expensive
change ([map_editor_architecture_and_limitations.md](map_editor_architecture_and_limitations.md) §2).

### What is built

`src/maps/metatiles.ts`:

- `metatileTable(room)` — every entry with its two words, its collision word
  and **how many cells use it**.
- `renderMetatileAtlas(rom, room, {columns, layer})` — the whole dictionary
  as one image. It is built as a *synthetic room* whose tilemaps are the
  dictionary, then handed to `renderRoomComposite`, so it goes through the
  same Mode 1 path the map does rather than a second copy of it. The parity
  test samples 640 cells across four rooms and requires every one to be
  pixel-identical to where that metatile appears in the room.
- `layer: 'layer1' | 'layer2' | 'composite'` — the same three views the map
  switch offers, so a stamp can be inspected one layer at a time.

The tab draws it as one PNG with a `<div>` per stamp, fetched on demand:
room `0x37`'s atlas is a 325 KB data URI and nobody should pay that for a
palette they never open.

## 3. Editing the layers independently

The natural request — "let me paint canopy without touching terrain" — runs
straight into §2: **a metatile carries both layers and the collision word.**
There is no per-layer grid to paint into. Painting a canopy tile onto a cell
means the cell needs a metatile whose `layer1` is the new word and whose
`layer2` and `collision` are the old ones.

So a per-layer brush is a **find-or-create** on the dictionary:

```
paint(cell, layer1 := W):
    want = (W, current.layer2, current.collision)
    i = dictionary.indexOf(want)          # exact match: free
    if i < 0: i = firstSpareSlot() or append()   # a new entry
    grid[cell] = id(i)
```

Three consequences the UI has to be honest about:

1. **A per-layer edit can change the dictionary**, which changes Block 3's
   size. The editor should show the dictionary count live and say when an
   edit added an entry.
2. **Spare slots are free, appends are not.** Reusing one of the 7591
   never-placed entries costs nothing; appending grows Block 3 and the
   WRAM footprint (§5).
3. **The combinatorial ceiling is real.** Offering "any canopy × any
   terrain" would let a user turn a 500-entry dictionary into thousands.
   The picker should default to combinations that already exist and treat
   creating a new one as a deliberate act.

The same mechanism covers collision: "make this cell solid but keep its
art" is find-or-create with a different third field. That is arguably the
single most useful edit in the whole editor, and it falls straight out.

## 4. The UI elements

### 4.1 Layer list

Standing panel, one row per layer, each with **visibility** and **lock**:

```
[x] [ ]  Canopy      (Layer 1 / BG2)
[x] [ ]  Terrain     (Layer 2 / BG1)
[x] [ ]  Collision
[x] [ ]  Triggers
[x] [ ]  Objects
[x] [ ]  Spawns
```

The tab's existing feature toggles are this list in embryo; they need the
lock column and a notion of the *active* layer, which is what a brush
writes into.

### 4.2 Tile palette — built, and docked

The dictionary as a sheet, with the three layer views, a used/spare filter,
and a detail line decoding the selected stamp's words. A brush is a
selected stamp.

In edit mode the section is **moved** next to the map rather than rendered
twice, so there is one node, one set of handlers, and one selection
wherever it is sitting.

### 4.3 Tools — built

| Tool | Does |
|---|---|
| **paint** | click or drag to stamp the brush |
| **rect** | drag a rectangle and fill it |
| **pick** | take the stamp under the cursor as the brush |
| **copy** | drag a region, then click to stamp it elsewhere |
| **move** | the same, but the source is backfilled with the brush |

`move` has to backfill, because the format has no empty cell: every cell
holds some metatile, so "move this window" must say what is left behind.
Using the brush for it is the one answer that is the user's choice rather
than the editor's guess.

Undo is per **gesture**, not per cell — a rectangle fill or a paste undoes
in one step, which is what makes "put the window back" one keystroke.
`⌘Z` / `⌘⇧Z`, and `Esc` drops a selection.

Still missing: flood fill, which needs a rule — fill by *matching metatile
id*, not by appearance, since two ids can look identical and behave
differently.

### 4.3.1 How a stroke is drawn

A painted cell is drawn **client-side, out of the palette atlas the tab has
already loaded**: a nested `<svg>` whose `viewBox` crops one 16×16 stamp
out of the sheet, placed two map units wide. So a stroke is instant and
costs no round trip to the host. The host is only involved when a stamp
does not exist yet — the composer's new combinations — and then it renders
a handful of cells, not the room.

The layer sits directly above the map image and below everything else,
because an edit replaces map pixels: it is scenery, and the canopy and the
feature overlay still belong on top of it.

### 4.3.2 The composer — built

Pick a **canopy** source, a **terrain** source and a **collision** word by
clicking stamps in the palette, and add the combination. Two rules keep the
dictionary from exploding:

- an identical combination already in the room returns that stamp and adds
  nothing;
- an identical combination already in the draft returns the one it made.

`collision = terrain` fills the third field with whatever collision word the
room already pairs with that terrain, which is the right default nine times
out of ten. New stamps continue past the room's own dictionary — index
`count + n` — which is exactly how they would be appended to Block 3.

### 4.4 Properties inspector

Context-sensitive, driven by selection:

- **nothing selected** → room header: size, origin, the Mode 1 registers
  (`displayTm`, `subscreenTs`, `colorMath`, `colorWindow`), tile families.
- **a cell** → its metatile id, the three words, how many other cells share
  it.
- **a trigger** → its box and script id.
- **an object** → its states, with the thumbnails the tab already renders.

### 4.5 Counts: triggers and objects

Both are plain arrays of fixed-size records, and both are the easiest real
edits in the whole editor:

| | Record | Vanilla range | Ceiling |
|---|---|---|---|
| Step-on triggers | 6 bytes (`y1 x1 y2 x2 scriptId`) | 0–65 | 2-byte length field; blob size |
| B-triggers | 6 bytes, same shape | 0–58 | same |
| Objects | descriptor + a stamp block | 0–72 | 1-byte count = 255; ~45 is the practical limit |

An add/remove/reorder table with a row per record, editable boxes drawn on
the map. `encode_room.py`'s `build_blob` already writes both trigger arrays
from lists, and `build_object_area` rebuilds the object area from an object
list — so the encoder side of this exists today.

### 4.6 Resize

The dangerous one; see §5.

## 5. What the format makes hard

**`baseMetatile = width * height * 2`.** The metatile ids the grid stores
are WRAM offsets *past the grid itself*, so **resizing a room renumbers
every metatile in it**. A resize is therefore: change W/H, recompute the
base, rewrite every cell id, and re-encode Block 2 — not a crop of a
bitmap. Doable, but it must be one atomic operation, never a nudge-able
handle that re-encodes on every drag.

**The WRAM window.** Grid plus dictionary share the buffer at `$7F0000`:
`width*height*2 + metatileCount*8` bytes. The largest vanilla room (`0x65`)
uses **32680 bytes**, just under 32 KB — consistent with a 32 KB window,
though nothing traced proves that is the limit. Until it is traced, the
editor should show the figure and warn past the vanilla maximum rather than
enforce a number it invented.

**Animated tiles.** Section 2's V-blank DMA budget is the real limit on
mixing water and lava; vanilla rooms use 0–42 channels, median 4. See the
architecture page §2.3.

**Blob growth.** A rebuilt blob is usually bigger. That is handled — see §6.

## 6. Writing back into the ROM

**The encoder exists and is verified.** `tools/encode_room.py` in the
sibling `everscript` repo is the inverse of `dump_room.py`, and its two
self-checks both pass on this ROM today:

```
byte-exact round-trip: 127/127 rooms     # model_from_rom -> build_blob == original bytes
re-encoded round-trip:  127/127 rooms    # re-encode blocks 1-3 -> decode == original content
```

The pieces an editor calls:

| Function | Does |
|---|---|
| `model_from_rom(rom, id)` | lossless model of the existing blob |
| `rebuild_model(rom, id, room_data)` | re-encode blocks 1–3 and the object area from **edited** decoded data |
| `build_blob(model)` | the bytes the loader expects |
| `write_room_into_rom(rom, id, blob, at_offset)` | place it and repoint `$9FFDE7 + id*4` |
| `verify_lossless` / `verify_rebuild` | the two checks above |

`rebuild_model` takes a `dump_room`-shaped dict, so **the edit surface is
the same JSON the decoder already emits** — header hex, trigger lists, tile
families, tile palette, the metatile grid, the Block 3 slices, the object
list. An editor does not need a new interchange format; it needs to hand
back a modified copy of what it read.

Growth is handled: `write_room_into_rom` writes in place when the blob still
fits and otherwise relocates it and rewrites the pointer, refusing to cross
a HiROM bank boundary. `rebuild_model` also keeps whichever encoding of each
block is smallest, including the original payload when its content did not
change, so an unchanged block never costs anything.

### The draft

The editor's output is a JSON draft, copied to the clipboard and opened as
an untitled document:

```json
{
  "roomId": 118,
  "baseMetatile": 7280,
  "originalMetatileCount": 702,
  "cells": [ { "x": 12, "y": 30, "metatileId": 7392 } ],
  "appendMetatiles": [ { "layer1": 13706, "layer2": 6604, "collision": 4127 } ]
}
```

`cells` carries **WRAM ids**, not dictionary indices, because that is what
`layer1_metatile_ids` holds — a draft that handed back indices would be
silently wrong, so `map-editor.test.js` pins it. Applying it is: write each
cell into the grid, append each new stamp to the three Block 3 slices, and
call `rebuild_model`.

### What is still to decide

- **Which side encodes.** The read path was *ported* to TypeScript and is
  held to the Python by `npm run check:maps`. The write path could go the
  same way, or the extension could shell out to the existing Python. Porting
  keeps the extension self-contained; shelling out reuses something already
  verified. Not decided here.
- **Where free space is.** Relocation needs a free-space map of the ROM.
  Nothing computes one yet.
- **Confirmation.** Writing to a ROM is destructive and irreversible.
  Whatever the button is, it takes an explicit confirmation and writes a
  backup first.

## 7. What to borrow from other editors

Conventions worth copying, named for where they are best known — as
interface precedent, not as code to read:

- **Lunar Magic** (Super Mario World): a separate *16×16 tile map* window as
  the brush source, and explicit per-layer editing modes. Both map directly
  onto §2 and §4.1. Its "ExGFX" concept — extending the graphics budget
  rather than swapping within it — is the same shape as adding a metatile.
- **Tiled**: the layer list with visibility and lock, the tool palette, the
  properties panel driven by selection, and a real undo stack. §4 is
  essentially Tiled's layout applied to this format.
- **ZScream / Hyrule Magic** (A Link to the Past): room-based editing where
  objects are *records with states*, not painted pixels. That is exactly
  Section 3, and the tab's object-state chips already work this way.
- **Temporal Flux** (Chrono Trigger): editing the map and its event scripts
  in one tool. This repo already decodes the scripts, so the two halves are
  both present — see [/simulation](../../simulation/README.md).
- **LazyShell** (Super Mario RPG): live patching with verification. The
  equivalent here is running `verify_rebuild` on the edited room before the
  write, which costs nothing and catches an encoder bug before it reaches
  the ROM.

The one thing not to borrow: editors that treat a map as a bitmap. This
format is a dictionary plus a grid, and an editor that hides that will
generate a dictionary entry for every brush stroke.
