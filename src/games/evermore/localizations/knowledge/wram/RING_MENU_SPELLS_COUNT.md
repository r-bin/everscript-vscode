---
addr: 7E0C6B
size: 2
kind: var
name: RING_MENU_SPELLS_COUNT
title: Number of eligible alchemy formulas in Formulas / Spells Ring Menu
lifetime: room
confidence: confirmed
tags: [ring-menu, alchemy, spells]
evidence: ["disasm: func_8E9DAE ($8E:9DAE) scans known alchemy formulas, increments $0C6B, and stores initial selection in $0C6D", "disasm: populates formula IDs array at $0C6F..$0C8E"]
see: [knowledge/wram/RING_MENU_SPELLS_SELECTION.md, rom/8e9dae.md]
---
16-bit counter tracking the number of known alchemy formulas displayed in the Formulas Ring Menu.
