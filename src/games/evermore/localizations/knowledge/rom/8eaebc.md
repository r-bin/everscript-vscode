---
addr: 8EAEBC
kind: code
category: 🧠
name: ring_menu_load_category_icons
title: Stream ring menu item icons and assign palettes to display slots
confidence: confirmed
tags: [ui, ring-menu, graphics, vram, cgram]
evidence: ["disasm: $8E:AEBC loops through category item array at DP $95, queries master table $8E:8000, allocates CGRAM palette via $90:CEED into display entry +$0C, streams 16x16 icon to VRAM via $90:80CE, advances slot by 16 bytes ($7E:06A3), sets cache flag $7E:0BF9 = 0xFFFF", "docs/disassembly/ui/ring-menu-icons.md"]
see: [rom/8eaefd.md, rom/8eae85.md, docs/disassembly/ui/ring-menu-icons.md]
---
Iterates through all item IDs in the active ring menu category descriptor (`DP $95`):
1. Resolves item descriptor pointer from `$8E:8000,x`.
2. Reads palette ID from descriptor `+0x04` and dynamically allocates a CGRAM slot via `$90:CEED`.
3. Stores allocated palette index into ring display entry `+$0C` (`$7E:06A3 + index * 16`).
4. Reads icon graphics index from descriptor `+0x02` and streams 16x16 icon graphics tiles to VRAM via `$90:80CE`.
5. Advances display slot by 16 bytes until all category items are loaded.
6. Sets `$7E:0BF9 = 0xFFFF` indicating ring menu icon cache is valid.

## Addresses
- Category Descriptor Pointer: DP `$95`
- Item Master Descriptor Table: `$8E:8000`
- Ring Display Entry Base: `$7E:06A3`
- CGRAM Palette Allocator: `$90:CEED`
- VRAM Tile Streamer: `$90:80CE`
- Ring Menu Icon Cache Flag: `$7E:0BF9`
