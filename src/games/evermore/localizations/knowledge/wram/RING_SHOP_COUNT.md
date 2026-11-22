---
addr: 7E0BA1
size: 2
kind: var
name: RING_SHOP_COUNT
title: Item count of the shop rings (five ring ids share it)
type: u16
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $0BA1; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
How many items the shop rings (five ring ids share it) holds (0: the flow skips the ring). Filled by `shop_load_catalog`.
