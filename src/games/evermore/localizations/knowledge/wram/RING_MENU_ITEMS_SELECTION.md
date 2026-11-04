---
addr: 7E0C49
size: 2
kind: var
name: RING_MENU_ITEMS_SELECTION
title: Currently highlighted consumable item cursor selection in Items Ring Menu
lifetime: room
confidence: confirmed
tags: [ring-menu, inventory, items]
evidence: ["disasm: func_8E9DAE ($8E:9DAE) zeroes $0C49 and copies initial cursor selection", "disasm: joypad ring navigation wraps $0C49 between 0 and $0C47 - 1"]
see: [knowledge/wram/RING_MENU_ITEMS_COUNT.md, routines/ring_menu_inventory_item_availability_filter.md]
---
16-bit cursor index identifying the currently highlighted consumable item in the Items Ring Menu.
