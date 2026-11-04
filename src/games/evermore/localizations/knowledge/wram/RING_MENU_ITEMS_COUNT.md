---
addr: 7E0C47
size: 2
kind: var
name: RING_MENU_ITEMS_COUNT
title: Number of available consumable items in Items Ring Menu
lifetime: room
confidence: confirmed
tags: [ring-menu, inventory, items]
evidence: ["disasm: func_8E9DAE ($8E:9DAE) scans 72 inventory slots in $7E:231D, verifies item validity via table $C4:5ABE, and increments $0C47", "disasm: populates consumable item slot array at $0C4B..$0C6A"]
see: [knowledge/wram/RING_MENU_ITEMS_SELECTION.md, knowledge/wram/ARMOR_QTY_GRASS_VEST.md, rom/8e9dae.md]
---
16-bit counter tracking the number of non-zero consumable items populated in the Items Ring Menu.
