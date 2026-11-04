---
addr: 8EAEFD
size: 33
end: 8EAF1D
kind: code
category: 🧠
name: ring_menu_cache_item_palettes
title: Pre-allocate CGRAM palettes for companion ring menu items
confidence: confirmed
tags: [ui, ring-menu, cgram, palettes]
evidence: ["disasm: $8E:AEFD loops over category items at DP $95, queries $8E:8000, and calls palette allocator $90:CEED without streaming VRAM tiles", "docs/disassembly/ui/ring-menu-icons.md"]
see: [routines/ring_menu_load_category_icons.md, docs/disassembly/ui/ring-menu-icons.md]
---
Loops through the items in the companion category descriptor (`DP $95`), queries the master item table at `$8E:8000`, and pre-allocates CGRAM palette entries via `$90:CEED` for fast category switching.

## Addresses
- Category Descriptor Pointer: DP `$95`
- Item Master Descriptor Table: `$8E:8000`
- CGRAM Palette Allocator: `$90:CEED`
