---
addr: 7E0C8F
size: 2
kind: var
name: RING_BAZOOKA_AMMO_COUNT
title: Item count of the bazooka ammo ring
type: u16
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $0C8F; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
How many items the bazooka ammo ring holds (0: the flow skips the ring). Filled by `ring_bazooka_ammo_build`.

Previously believed: "Total learned alchemy formulas populated into secondary ring menu" (RING_MENU_ALCH_FORMULA_COUNT).
