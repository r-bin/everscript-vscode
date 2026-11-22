---
addr: 7E0CB7
size: 2
kind: var
name: RING_CALL_BEAD_SPELLS_CURSOR
title: Selected item of the Call Bead spells ring
type: u16
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $0CB5; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
The item the cursor rests on, 0 to count-1.

Previously believed: "Currently highlighted formula action cursor selection in formula submenu" (RING_MENU_FORMULA_ACTION_SELECTION).
