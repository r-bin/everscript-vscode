---
addr: 8EAFF4
kind: code
category: 🧠
name: ring_menu_rotate_next_item
title: Rotate ring menu clockwise to select the next item
confidence: confirmed
tags: [ui, ring-menu, math, input]
evidence: ["disasm: $8E:AFF4 increments active_index in category header DP $95 (wrapping to 0 if >= item_count), computes target angle via hardware division, stores into $7E:061D, and enters rotation loop at $8E:B02C", "docs/disassembly/ui/ring-menu-rotation.md"]
see: [rom/8eaf1e.md, rom/8eb02c.md, docs/disassembly/ui/ring-menu-rotation.md]
---
Increments the selected item index in the active ring menu category (`DP $95`):
1. Increments `category->active_index` (`+$02`); wraps around to `0` if `>= item_count`.
2. Calculates new target angle using SNES hardware division:
   `target_angle = ((item_index << 8) | 0x80) * 2 / item_count`
3. Stores target angle into `$7E:061D`.
4. Enters the clockwise rotation loop at `$8E:B02C`.

## Addresses
- Category Header Pointer: DP `$95`
- Target Orbital Angle: `$7E:061D`
- Hardware Division Registers: `$00:4204` / `$00:4206` / `$00:4214`
- Rotation Loop Entry: `$8E:B02C`
