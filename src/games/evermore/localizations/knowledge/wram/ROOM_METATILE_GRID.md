---
addr: $7F:0000
name: ROOM_METATILE_GRID
type: RoomMetatileGrid
tags: [map, metatiles, bank7f, widescreen, widescreen.collision, widescreen.streaming]
confidence: verified
evidence: ["disasm: Primary decompressed room metatile grid buffer ($7F:0000..$7F:7FFF) holding live metatile IDs, Layer 1/2 VRAM tile words, and elevation/collision attributes ($80:C0B5, $8F:9F05, $90:9DE8, $90:A739)", "docs/map-format/map_decompression_trace_analysis.md"]
---
Primary decompressed room field metatile grid and attributes buffer ($7F:0000..$7F:7FFF, 32 KB).

### Inner Struct Layout (`RoomMetatileGrid`):
- `+$0000` (`layer1_grid`, `u16[8192]` / 16 KB): Layer 1 room metatile grid words populated by 2D Markov bitstream decoder ($8C:9BD0).
- `+$4000` (`collision_attrs`, `u16[4096]` / 8 KB): Metatile collision attribute words and 2-bit elevation planes ($7F:0004 offset stride, $90:9DE8).
- `+$6000` (`terrain_mutation`, `u8[8192]` / 8 KB): Cuttable grass and dynamic room terrain mutation replacement table staging buffer ($90:A739).

## Widescreen notes

The whole room is resident: every collision probe (`tile_property_at_pixel_xy` $90:9815, `entity_screen_tile_projection` $90:9561) indexes this grid by world coordinates (`2 * (row * width + col)`, coordinates masked to `$0FF0`), and its word is an offset into the room's metatile definitions in bank `$7F` (`$7F:0000+w` = BG1 tile word, `$7F:0002+w` = BG2 tile word, `$7F:0004+w` = collision word). So whole-map collision already exists for every entity, and margin prefill can be computed from it exactly (asm read 2026-11-09).
