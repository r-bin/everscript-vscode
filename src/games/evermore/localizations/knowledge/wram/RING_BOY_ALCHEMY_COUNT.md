---
addr: 7E07EC
size: 2
kind: var
name: RING_BOY_ALCHEMY_COUNT
title: Item count of the Boy's alchemy ring
type: u16
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $07EC; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
How many items the Boy's alchemy ring holds (0: the flow skips the ring). Filled by `ring_alchemy_build`.
