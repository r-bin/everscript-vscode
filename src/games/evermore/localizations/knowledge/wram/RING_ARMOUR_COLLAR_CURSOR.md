---
addr: 7E0C6D
size: 2
kind: var
name: RING_ARMOUR_COLLAR_CURSOR
title: Selected item of the Dog's collar ring
type: u16
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $0C6B; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
The item the cursor rests on, 0 to count-1.

Previously believed: "Currently highlighted formula cursor selection in Formulas / Spells Ring Menu" (RING_MENU_SPELLS_SELECTION).
