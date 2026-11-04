---
addr: 7E0CDB
size: 2
kind: var
name: SHOP_MENU_SELECTION
title: Currently highlighted merchant interaction option cursor index
lifetime: room
confidence: confirmed
tags: [shop, dialogue, menu, ui]
evidence: ["disasm: func_8E8D05 ($8E:8D05) tests $0CDB against $0CD9; if >= $0CD9, resets $0CDB = 0", "disasm: updated on joypad up/down in merchant dialogue menus"]
see: [knowledge/wram/SHOP_MENU_OPTION_COUNT.md, routines/shopkeeper_dialogue_choice_menu_item_setup.md]
---
16-bit cursor index identifying the highlighted merchant interaction choice in shop menus.
