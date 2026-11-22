---
addr: 7E0C93
size: 32
kind: var
name: RING_BAZOOKA_AMMO_ITEMS
title: Ring item ids of the bazooka ammo ring
type: u16[16]
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $0C8F; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
Up to 16 ring item ids (`RING_ITEMS`, `menus/ring_items/` in Open Evermore), in ring order.
