# Entity Position & Map Tile Collision Synchronization

## Overview
When an entity moves, teleports via script (Opcode `0x43`), or enters a new room, the engine must update its world coordinates (X, Y, Z), recalculate its 16x16 tile coordinates, index into the loaded room tilemap buffer at `$7F:0000`, retrieve the terrain surface flags (solid walls, ramps, water, damage floors) from the tile attribute table at `$7F:0004`, and synchronize all child entities (shadows, weapons, barrier shields) leashed to the parent entity.

---

## Memory Map & Data Structures

### Entity Coordinate & Collision Fields (`$7E:XXXX`)
- `+0x18`: `z` (Elevation / Jump altitude, 16-bit)
- `+0x1A`: `x` (World X coordinate in pixels, 16-bit)
- `+0x1C`: `y` (World Y coordinate in pixels, 16-bit)
- `+0x3A`: `tile_offset` (Linear byte offset into tilemap buffer `$7F:0000`)
- `+0x3C`: `surface_flags` (Terrain collision and surface properties word)
- `+0x62`: `tile_coord_packed` (Packed `(tile_y << 8) | tile_x`)
- `+0x6A`: `shadow_entity_id` (Child shadow entity handle; negative if none)
- `+0x6C`: `held_entity_id` (Carried / weapon entity handle; negative if none)
- `+0x98`: `aux_entity_id` (Player aura / barrier / effect entity handle; negative if none)

### Map Header & SNES Hardware Registers
- `$7E:08EE`: `map_width_tiles` (Map width in 16x16 tiles)
- `$7E:08EF`: `map_height_tiles` (Map height in 16x16 tiles)
- `$00:4202`: `WRNUMA` (SNES 8-bit * 8-bit unsigned hardware multiplier input)
- `$00:4203`: `WRNUMB`
- `$00:4216`: `RDMPY` (SNES 16-bit unsigned hardware multiplication product)

---

## Decompiled C Code

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CEC8E_entity_position.c`](../../../reconstructed-c/8C/8CEC8E_entity_position.c).
> [View in VFS: soe://rom/code/8CEC8E](soe://rom/code/8CEC8E?c=1&asm=0)

