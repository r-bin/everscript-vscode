---
addr: 7E0C91
size: 2
kind: var
name: RING_BAZOOKA_AMMO_CURSOR
title: Selected item of the bazooka ammo ring
type: u16
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $0C8F; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
The item the cursor rests on, 0 to count-1.

Previously believed: "Currently highlighted formula cursor selection in secondary formula ring menu" (RING_MENU_ALCH_SELECTION).
