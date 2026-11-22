---
addr: 7E0CDB
size: 2
kind: var
name: RING_CALL_BEAD_CALLERS_CURSOR
title: Selected item of the Call Bead callers ring
type: u16
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $0CD9; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
The item the cursor rests on, 0 to count-1.

Previously believed: "Currently highlighted merchant interaction option cursor index" (SHOP_MENU_SELECTION).
