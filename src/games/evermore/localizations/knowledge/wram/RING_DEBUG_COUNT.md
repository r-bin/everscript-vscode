---
addr: 7E0F5A
size: 2
kind: var
name: RING_DEBUG_COUNT
title: Item count of the debug ring (never filled in this release: its count stays 0, so the Boy's flow skips it)
type: u16
lifetime: room
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: RING_BUFFERS ($8E:9920) holds $0F5A; ring loops read +0 count, +2 cursor, +4 items through DP $95"]
see: ["docs/open-evermore/resources.md"]
---
How many items the debug ring (never filled in this release: its count stays 0, so the Boy's flow skips it) holds (0: the flow skips the ring). The CDL recorded no access in vanilla play (it was believed to be a 38-byte gap: one ring buffer and 2 bytes).
