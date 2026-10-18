---
addr: 8EAF1E
kind: code
category: 🧠
name: ring_menu_rotate_previous_item
title: Rotate ring menu counter-clockwise to select the previous item
confidence: confirmed
tags: [ui, ring-menu, math, input]
evidence: ["disasm: $8E:AF1E decrements active_index in category header DP $95 (wrapping to item_count - 1), computes target angle via SNES hardware division registers $4202/$4204/$4206/$4214, stores into $7E:061D, and enters rotation loop at $8E:AF54", "docs/disassembly/ui/ring-menu-rotation.md"]
see: [rom/8eaff4.md, rom/8eaf86.md, docs/disassembly/ui/ring-menu-rotation.md]
---
Decrements the selected item index in the active ring menu category (`DP $95`):
1. Decrements `category->active_index` (`+$02`); wraps around to `item_count - 1` if negative.
2. Calculates new target angle using SNES hardware division:
   `target_angle = ((item_index << 8) | 0x80) * 2 / item_count`
3. Stores target angle into `$7E:061D`.
4. Enters the counter-clockwise rotation loop at `$8E:AF54`.

## Addresses
- Category Header Pointer: DP `$95`
- Target Orbital Angle: `$7E:061D`
- Hardware Division Registers: `$00:4204` / `$00:4206` / `$00:4214`
- Rotation Loop Entry: `$8E:AF54`
