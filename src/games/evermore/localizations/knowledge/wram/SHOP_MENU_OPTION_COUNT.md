---
addr: 7E0CD9
size: 2
kind: var
name: SHOP_MENU_OPTION_COUNT
title: Total active shopkeeper dialogue interaction options in merchant choice menu
lifetime: room
confidence: confirmed
tags: [shop, dialogue, menu, ui]
evidence: ["disasm: func_8E8D05 ($8E:8D05) evaluates player transaction capability flags in $7E:225C..$7E:225D, builds choice IDs into $0CDD,X, and increments option count $0CD9", "disasm: clamps cursor $0CDB < $0CD9"]
see: [knowledge/wram/SHOP_MENU_SELECTION.md, rom/8e8d05.md]
---
16-bit count of active merchant interaction choices (such as Buy, Sell, Ingredients, Talk, Exit) displayed in shop dialogue menus.
