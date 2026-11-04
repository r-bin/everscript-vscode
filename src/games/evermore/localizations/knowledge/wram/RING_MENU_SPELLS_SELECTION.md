---
addr: 7E0C6D
size: 2
kind: var
name: RING_MENU_SPELLS_SELECTION
title: Currently highlighted formula cursor selection in Formulas / Spells Ring Menu
lifetime: room
confidence: confirmed
tags: [ring-menu, alchemy, spells]
evidence: ["disasm: func_8E9DAE ($8E:9DAE) zeroes $0C6D and clamps cursor within $0C6B"]
see: [knowledge/wram/RING_MENU_SPELLS_COUNT.md, rom/8e9dae.md]
---
16-bit cursor index identifying the currently selected formula in the Spells/Formulas Ring Menu.
