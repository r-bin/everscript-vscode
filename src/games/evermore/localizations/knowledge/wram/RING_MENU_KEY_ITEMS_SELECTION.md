---
addr: 7E0C01
size: 2
kind: var
name: RING_MENU_KEY_ITEMS_SELECTION
title: Key Items ring menu selection, set to the item count when the list is built
lifetime: room
confidence: likely
tags: [ring-menu, inventory, items]
evidence: ["disasm: $8E:9E3C STZ $0C01, $8E:9E69 STA $0C01 from the count $0BFF; no other absolute access in bank $8E, so its use as the cursor is the map's reading, not traced", "disasm: populates key item ID list in $0C03,Y"]
see: [knowledge/wram/RING_MENU_ITEMS_COUNT.md, rom/8e9dae.md]
---
16-bit counter tracking the number of active key/story items displayed in the Key Items Ring Menu.
Populated by `func_8E9DAE` before opening the ring menu.
