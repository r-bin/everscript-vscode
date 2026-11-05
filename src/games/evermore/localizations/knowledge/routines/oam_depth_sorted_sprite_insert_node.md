---
addr: 80960A
end: 809684
size: 123
kind: code
category: 🧠
name: oam_depth_sorted_sprite_insert_node
title: Inserts sprite render records into a Y-depth sorted linked list for proper hardware OAM layering
confidence: confirmed
tags: [sprites, oam, rendering]
evidence:
  - "disasm: full body read ($80:960A-$80:9684, 51 instructions); splices the 15-byte sprite node at $7E:1276 into the doubly-linked depth-sorted list at $7E:50A7.. using the bucket finger at $7E:50AD + ((key & $03C0) >> 3) and advances $7E:1276 by $000F"
  - "c: G1 passed (tools/c-to-rom/g1.mts)"
---
Inserts the 15-byte sprite node at `$7E:1276` (saved in DP `$14`) into the doubly-linked depth-sorted sprite list (`$7E:50A7..`; `+0` = prev, `+2` = next, `+4` = depth key) and advances `$7E:1276` by `$000F`.

Reads the node's depth key from `+$04,Y` (saved in DP `$12`), computes bucket offset `X = (key & $03C0) >> 3`, loads the bucket's last-visited finger `Y` from `$7E:50AD,X`, and updates `$7E:50AD,X` to the new node. When `key >= Y[+4]` (signed `BMI` not taken) it walks forward via `+2` (`LDX $0002,Y` / `LDY $0002,X`, unsigned `BCC`/`BCS`) until the next node's key exceeds `key`; when `key < Y[+4]` it walks backward via `+0` (`LDX $0000,Y` / `LDY $0000,X`, signed `BPL`/`BMI`) until the previous node's key is `<= key`. Splices the node between `X` and `Y`, sets `$7E:1276 = node + $000F`, and restores `DB`.

## Callers
- `$8F:C6C5` (`sprite_sorting_canopy_occlusion_and_render_depth`)
- `$90:81F0` (`particle_oam_depth_sort_and_projection`)
- `$90:DB9E` (`entity_shadow_oam_sprite_render`)

## Callees
- None

## Variables and memory
- `$7E:1276` (`SPRITE_FREE_LIST_HEAD`: next free 15-byte sprite node, advanced by `$000F`)
- `$7E:50AD,X` (`+6` of each 8-byte bucket head at `$7E:50A7`: finger to the last inserted node in that depth bucket)
- `+$00,Y`, `+$02,Y`, `+$04,Y` (prev link, next link, and depth key of a sprite list node)
