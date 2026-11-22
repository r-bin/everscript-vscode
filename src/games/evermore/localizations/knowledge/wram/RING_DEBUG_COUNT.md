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

The ring's loop is a bare `rts` (`ring_debug_loop`): the debug functions are gone. A script that fills this count and `RING_DEBUG_ITEMS` would show the ring in the Boy's flow, but pressing an item would do nothing (not tried in game). Nothing in vanilla ever touches the 38 bytes `$0F5A-$0F7F`, which is why the WRAM proof of concept parks variables there (docs/open-evermore/wram.md).
