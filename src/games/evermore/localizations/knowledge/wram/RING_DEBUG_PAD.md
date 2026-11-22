---
addr: 7E0F7E
size: 2
kind: var
name: RING_DEBUG_PAD
title: Two bytes after the debug ring's buffer
type: u8[2]
lifetime: unknown
confidence: likely
tags: ["unused"]
evidence: ["cdl: no access in vanilla play (the old 38-byte gap entry ROOM_PPU_MIRROR_ALIGN_GAP at $0F5A)"]
see: ["knowledge/wram/RING_DEBUG_COUNT.md"]
---
Unused to our knowledge: the end of the 38 bytes from `$0F5A`, of which the debug ring's buffer takes 36.
