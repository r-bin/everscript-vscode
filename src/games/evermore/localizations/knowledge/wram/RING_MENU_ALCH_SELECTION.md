---
addr: 7E0C91
size: 2
kind: var
name: RING_MENU_ALCH_SELECTION
title: Currently highlighted formula cursor selection in secondary formula ring menu
lifetime: room
confidence: confirmed
tags: [ring-menu, alchemy, spells]
evidence: ["disasm: func_8E9A2F ($8E:9A2F) verifies active cursor selection within $0C8F and stores into $0C91"]
see: [knowledge/wram/RING_MENU_ALCH_FORMULA_COUNT.md, routines/ring_menu_usable_alchemical_formula_filter.md]
---
16-bit cursor index identifying the currently selected formula in the secondary formula ring menu buffer.
