---
addr: 8FC6C5
end: 8FC759
size: 149
kind: code
category: 🧠
name: sprite_sorting_canopy_occlusion_and_render_depth
title: Evaluates canopy tile occlusion bit 12 and registers entity priority depth in the OAM sort list
confidence: confirmed
tags: [sprites, oam, rendering, canopy]
evidence:
  - "disasm: full body read ($8F:C6C5-$8F:C759, 55 instructions); calls $8F:C773 entity_sprite_depth and inserts the entity's secondary/shadow sprite (+$09..$0B) and primary sprite (+$06..$08) into the depth-sorted sprite list via $80:960A"
  - "c: G1 passed (tools/c-to-rom/g1.mts)"
---
Evaluates an entity's sprite depth and canopy priority via `$8F:C773` (`entity_sprite_depth`) and emits up to two 15-byte sprite sort nodes at `$7E:1276` via `$80:960A` (`oam_depth_sorted_sprite_insert_node`).

Takes the active entity record offset in DP `$4C` (`DB = $7E`). If `entity_sprite_depth` returns `0` (hidden or off-screen), returns immediately via `$8F:C6C4` (`RTS`). Otherwise:
1. **Secondary / shadow sprite (`+$09..$0B,X`):** When `+$0A,X != 0` and state word `+$12,X` bit 14 (`$4000`) is clear, fills the node at `Y = $1276` with sprite pointer `+$0C..$0E,Y = +$09..$0B,X`, screen X/Y `+$06,Y = DP $02` and `+$08,Y = DP $04`, attributes `+$0A,Y = DP $06`, and depth `+$04,Y = DP $08 - 10`, then inserts it via `$80:960A`.
2. **Primary sprite (`+$06..$08,X`):** When `+$07,X != 0`, state word `+$12,X` bit 15 (`$8000`) is clear, and height `+$1E,X >= 0`, fills the node at `Y = $1276` with sprite pointer `+$0C..$0E,Y = +$06..$08,X`, screen Y `+$08,Y = DP $04 - (height >> 4)` (with OAM priority bits in DP `$06` forced to `3` when `height >= $7E:23C5`), screen X `+$06,Y = DP $02`, attributes `+$0A,Y = DP $06`, and depth `+$04,Y = DP $08`, then inserts it via `$80:960A`.

## Callers
- `$8F:C61E` (`mode7_vehicle_cockpit_overlay_sprites`, via `jsr ($C618,x)` at `$8F:C62E`)

## Callees
- `$80:960A` (`oam_depth_sorted_sprite_insert_node`)
- `$8F:C773` (`entity_sprite_depth`)

## Variables and memory
- DP `$4C` (Active entity record offset in bank `$7E`)
- DP `$02`, `$04`, `$06`, `$08` (Screen X, screen Y, OAM attributes, and depth key from `entity_sprite_depth`)
- `$7E:1276` (`SPRITE_FREE_LIST_HEAD`: next free 15-byte sprite sort node)
- `$7E:23C5` (`COMPANION_LEASH_RADIUS` / height threshold for forcing sprite priority 3)
