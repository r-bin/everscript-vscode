# Rooms Tab — Map Coordinate System

## Coordinate Units

All coordinates in the Rooms tab use **8-px tile units**: 1 tile unit = 8 SNES pixels = one 8×8 sprite tile.

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

## Known Rooms Without `init_map`

Rooms that call `close_exits()` / `fade_in()` only (e.g. `raptors`) rely on the ROM data block bounds. The image dimensions serve as the tile range. Triggers and entrances still use the same 8-px tile coordinate space.
