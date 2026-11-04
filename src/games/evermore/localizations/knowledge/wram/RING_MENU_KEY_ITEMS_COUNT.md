---
addr: 7E0BFF
size: 2
kind: var
name: RING_MENU_KEY_ITEMS_COUNT
title: Number of eligible key / story items in Key Items Ring Menu
lifetime: room
confidence: confirmed
tags: [ring-menu, inventory, items]
evidence: ["disasm: $8E:9E39 STZ $0BFF, $8E:9E59 INC $0BFF for each eligible key item, $8E:9E65 LDA $0BFF / STA $0C01 at the end", "disasm: populates key item ID list in $0C03,Y"]
see: [knowledge/wram/RING_MENU_ITEMS_COUNT.md, routines/ring_menu_inventory_item_availability_filter.md]
---
16-bit counter tracking the number of active key/story items displayed in the Key Items Ring Menu.
Populated by `func_8E9DAE` before opening the ring menu.
