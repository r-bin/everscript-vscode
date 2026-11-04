---
addr: C44A76
end: C45801
size: 3468
kind: table
category: 🎨
name: tbl_item_icon_sprite_pointers
title: Master item, weapon, and ring menu icon sprite pointer table
confidence: confirmed
tags: [item, weapon, ring, menu, sprite, pointers, table]
evidence: ["binary data: 867 × 4-byte far pointer entries (3-byte far pointer + 1 null padding byte) addressing item icon graphic patterns across Banks $C7 and $C9 (out/recomp/asar/rom.bin:0x044A76)"]
see: [src/games/evermore/localizations/knowledge/routines/tbl_weapon_item_lore_descriptions.md]
---
Master pointer directory for ring menu item, weapon, armor, and alchemy formula graphical icons:
- Contains 867 4-byte pointer descriptors (3,468 bytes total, `$C4:4A76`..`$C4:5801`).
- Addresses compressed 16×16 and 8×8 4bpp sprite icons located in ROM Banks `$C7` and `$C9`.
- Streamed dynamically to PPU VRAM OBJ memory when opening the weapon, item, or alchemy ring menus.
