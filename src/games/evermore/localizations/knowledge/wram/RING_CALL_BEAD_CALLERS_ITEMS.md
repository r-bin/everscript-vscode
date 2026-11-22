---
addr: 7E0CDD
size: 16
kind: var
name: RING_CALL_BEAD_CALLERS_ITEMS
title: Ring item ids of the Call Bead callers ring
type: u16[8]
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $0CD9; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
Up to 4 ring item ids (the space runs to $0CEC) (`RING_ITEMS`, `menus/ring_items/` in Open Evermore), in ring order.
