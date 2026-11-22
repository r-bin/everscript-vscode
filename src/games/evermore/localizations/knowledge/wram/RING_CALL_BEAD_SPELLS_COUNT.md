---
addr: 7E0CB5
size: 2
kind: var
name: RING_CALL_BEAD_SPELLS_COUNT
title: Item count of the Call Bead spells ring
type: u16
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $0CB5; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
How many items the Call Bead spells ring holds (0: the flow skips the ring). Filled by `call_bead_fire_eyes_spells`.

Previously believed: "Total available formula action commands in Ring Menu formula submenu" (RING_MENU_FORMULA_ACTION_COUNT).
