---
addr: 7E0CB5
size: 2
kind: var
name: RING_MENU_FORMULA_ACTION_COUNT
title: Total available formula action commands in Ring Menu formula submenu
lifetime: room
confidence: confirmed
tags: [ring-menu, alchemy, command]
evidence: ["disasm: func_8E9CE5 ($8E:9CE5) and func_8E9D10 ($8E:9D10) set $0CB5 = 4 and bind action IDs ($00F8, $00FA, $00FC, $00FE) into $0CB9..$0CBF", "disasm: clamps selection cursor $0CB7 < $0CB5"]
see: [knowledge/wram/RING_MENU_FORMULA_ACTION_SELECTION.md, routines/ring_menu_build_alchemy_action_list.md]
---
16-bit count of active action commands (typically 4: Cast, Assign to Satchel, Check Ingredients, Discard) displayed in the formula context submenu.
