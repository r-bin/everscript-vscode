# Rooms Tab — Map Coordinate System

For the higher-level room-loader notes that back the Docs tab, see `docs/map-loading.md`.

## Coordinate Units

The Rooms tab uses **two coordinate spaces**:

| Entity | Grid | 1 unit = |
|--------|------|---------|
| Entrances, enemies, `init_map` bounds | **8×8-tile grid** | 8 SNES pixels |
| Step-on / B-trigger coords | **16×16-tile grid** | 16 SNES pixels = 2 × 8px tiles |

Trigger coords are converted to 8px-tile SVG space using the formula:

```
svg_x = (raw_x - offX) * 2
svg_y = (raw_y - offY) * 2
svg_w = (raw_x2 - raw_x1) * 2
svg_h = (raw_y2 - raw_y1) * 2
```

Where `offX` and `offY` come from **bytes 0 and 1 of the room data block** (see §Data Block below).

## Trigger Origin — `trig_off_x / trig_off_y`

### What it is

The game writes the room's **world tile origin** (in 16px-tile units) to RAM `0x7E0F86` (`trig_off_x`) and `0x7E0F88` (`trig_off_y`) when loading a room. These are bytes 0 and 1 of the ROM data block at `dataptr`.

### Why the Lua uses `× 16`

The Lua overlay computes screen positions in SNES sub-pixel space (camera and sprite coords use 16 sub-pixels per 8px tile):

```lua
pos_x = (memory.read_u8(ptr+1) - trig_off_x) * 16   -- sub-pixels from room origin
pos_y = (memory.read_u8(ptr+0) - trig_off_y) * 16
```

The Lua works because it subtracts the room origin, producing room-relative sub-pixel coords, then subtracts camera to get screen position. Our panel maps these to 8px-tile SVG space by applying `(raw - off) * 2`.

### Verified example — Room 0x5c (Raptors)

ROM data block at `0x28f590`:
- `offX = meta[0] = 0x09 = 9`
- `offY = meta[1] = 0x15 = 21`

| Trigger | Raw `(x1,y1)→(x2,y2)` | SVG tile `(x,y)→(x+w,y+h)` | Expected (near entrance) |
|---------|----------------------|---------------------------|--------------------------|
| step-on 0 (exit north) | `(21,21)→(24,23)` | `(24,0)→(30,4)` | North entrance at `(27,3)` ✓ |
| step-on 1 (exit south) | `(22,45)→(25,47)` | `(26,48)→(32,52)` | South entrance at `(29,51)` ✓ |
| step-on 2 (raptor battle) | `(20,36)→(28,37)` | `(22,30)→(38,32)` | Center of map ✓ |

## Room Image Alignment

Grizzly map images are at **1 image pixel = 1 SNES pixel**, so:

```
width_in_tiles  = image_width_px  / 8
height_in_tiles = image_height_px / 8
```

The SVG `viewBox` is set to the tile range. Both the `<img>` and SVG overlay fill the same container so image pixels and SVG tile units align exactly.

The container height is `520 × (H_tiles / W_tiles)` to preserve aspect ratio.

## Trigger Coordinate Sourcing

Trigger coordinates come from the **script dump** (`script_all`), not from `.evs`. The `.evs` enums supply names only. Names are correlated by index order:

```
script_all step-on [N]  ↔  enum stepon_trigger { member[N] }
```

## Data Block Layout

From `list-rooms.cpp` and Lua analysis (`soestuff.lua`):

```
dataptr → [  0] offX      (u8)  — trig_off_x = room x-origin in 16px-tile units
           [  1] offY      (u8)  — trig_off_y = room y-origin in 16px-tile units
           [2..12] ...     (u8×11) — other room metadata (partially unknown)
           [ 0x0d] step_len (u16) — step-on list byte length
           [ 0x0f] step[0..N] (6 bytes each: y1,x1,y2,x2,script_id16)
           [ 0x0f+N] b_len  (u16)
           [ 0x0f+N+2] b[0..M] (same 6-byte format)
           [ ... ] payload  — remaining room payload (visual / collision data), codec still unresolved
```

Important: the 6-byte record width is the current working model and matches the in-repo parser assumptions, but the external SoE tiles viewer C++ source is not present in this workspace, so that external comparison was not freshly re-verified here.

The map pointer table is at SNES `0x9ffde7` = ROM `0x1ffde7`. Each entry is 4 bytes; entry for map `id` is at `0x1ffde7 + id * 4` and contains a 24-bit SNES address to the data block.


| Source | Unit | How read |
|--------|------|----------|
| `entrance(x, y, DIR)` in `.evs` | 8-px tile | parsed from source |
| `init_map(x1,y1,x2,y2)` in `.evs` | 8-px tile | parsed from source |
| Step-on / B-trigger coords in `script_all` | 8-px tile | parsed from dump |
| Grizzly room images (`.png`) | 8 image-px per tile | image dims / 8 |

### Why the Lua uses `× 16`

The Lua overlay (`soestuff.lua`) computes:

```lua
pos_x = (trigger_tile - trig_off_x) * 16
```

…because the game's internal position register (`camera_x`, sprite coords) uses **sub-pixel units** where **16 sub-pixels = 8 SNES pixels = 1 tile**. This is separate from our display coordinate system. Our panel uses plain tile units throughout, matching the Grizzly PNG images.

### `trig_off_x / trig_off_y` (RAM `0x7E0F86` / `0x7E0F88`)

These are the room's **global world origin** in 8-px tile units. They allow the Lua to convert ROM trigger tile coords (global space) into screen-relative pixels:

```
screen_x = (global_trigger_tile - trig_off) * 16 - camera_sub_pixel
```

For rooms whose tilemap starts at world tile (0,0) — which is true for all rooms discovered so far — `trig_off = 0` and global tile coords equal room-local tile coords. Our panel assumes this and draws all entities directly at their tile coordinates.

## Room Image Alignment

The Grizzly map images are at **native SNES resolution** (1 image pixel = 1 SNES pixel = 1/8 tile). Image dimensions:

- width in tiles  = image_width_px / 8
- height in tiles = image_height_px / 8

The SVG `viewBox` is set to the tile range `(x1, y1, W, H)` where:
- If `init_map` is present: `x1=im.x1`, `y1=im.y1`, `W=im.x2-im.x1`, `H=im.y2-im.y1`
- If only image dims: `x1=0`, `y1=0`, `W=image_width/8`, `H=image_height/8`

Both the `<img>` element and the SVG overlay fill the same container, so image pixels and SVG tile units align exactly.

### Aspect Ratio

The container width is fixed at **520 px**. The container height is computed from the image aspect ratio:

```
height = 520 × (H_tiles / W_tiles)
```

This ensures 1 tile unit has the same display pixel size in X and Y — no distortion. Without this, tall rooms would appear vertically compressed and triggers would look offset toward the center.

## Trigger Coordinate Sourcing

Trigger coordinates come from the **script dump** (`script_all`), NOT from the `.evs` source. The `.evs` enums define trigger logic (names, code); the coordinates are stored in the ROM data block and only appear in `script_all`.

The **order** of triggers in `script_all` matches the **order** of enum members in the `.evs` source. This lets us correlate:

```
script_all step-on trigger [N]  ↔  enum stepon_trigger { member[N] }
```

So `exit_north` (index 0 in `.evs`) corresponds to the first step-on trigger in `script_all`.

## Data Block Layout

From `list-rooms.cpp`, the room data block at `dataptr`:

| Offset | Size | Content |
|--------|------|---------|
| `0x00` | 13 bytes | Room metadata (partially unknown) |
| `0x0d` | 2 bytes | Step-on trigger list length (bytes) |
| `0x0f` | N bytes | Step-on trigger entries (6 bytes each: `y1,x1,y2,x2,sid16`) |
| `0x0f+N` | 2 bytes | B-trigger list length |
| `0x0f+N+2` | M bytes | B-trigger entries (same 6-byte format) |

Each trigger entry byte layout in ROM: `[y1][x1][y2][x2][scriptId16]`  
`script_all` prints them as `[x1,y1:x2,y2]` (x first).

That print order is the likely reason the format can look inconsistent across tools: the record is still 6 bytes, but many dumps display `x` first for readability.

## Known Rooms Without `init_map`

Rooms that call `close_exits()` / `fade_in()` only (e.g. `raptors`) rely on the ROM data block bounds. The image dimensions serve as the tile range. Triggers and entrances still use the same 8-px tile coordinate space.
