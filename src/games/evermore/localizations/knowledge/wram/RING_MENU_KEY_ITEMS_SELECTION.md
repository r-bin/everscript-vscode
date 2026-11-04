---
addr: 7E0C01
size: 2
kind: var
name: RING_MENU_KEY_ITEMS_SELECTION
title: Number of eligible key / story items in Key Items Ring Menu
lifetime: room
confidence: confirmed
tags: [ring-menu, inventory, items]
evidence: ["disasm: func_8E9DAE ($8E:9DAE) checks inventory and stores total eligible key items in $0C01", "disasm: populates key item ID list in $0C03,Y"]
see: [ram/7e0c47.md, rom/8e9dae.md]
---
16-bit counter tracking the number of active key/story items displayed in the Key Items Ring Menu.
Populated by `func_8E9DAE` before opening the ring menu.
