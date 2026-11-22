---
addr: 7E07A4
size: 2
kind: var
name: RING_BOY_WEAPONS_COUNT
title: Item count of the Boy's weapons ring
type: u16
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $07A4; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
How many items the Boy's weapons ring holds (0: the flow skips the ring). Filled by `calc_equipped_armor_defense`.
