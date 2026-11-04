---
addr: 7E0CB7
size: 2
kind: var
name: RING_MENU_FORMULA_ACTION_SELECTION
title: Currently highlighted formula action cursor selection in formula submenu
lifetime: room
confidence: confirmed
tags: [ring-menu, alchemy, command]
evidence: ["disasm: func_8E9CE5 ($8E:9CE5) clamps selection cursor $0CB7 < $0CB5 (4)", "disasm: updated on directional pad navigation within formula submenu"]
see: [knowledge/wram/RING_MENU_FORMULA_ACTION_COUNT.md, rom/8e9ce5.md]
---
16-bit cursor index identifying the highlighted action command in the formula context submenu.
