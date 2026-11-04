---
addr: 7E7D51
end: 7E95A4
size: 6228
kind: buffer
name: tier1_tile_slot_lookup
title: Dynamic OBJ VRAM LRU allocation lookup table ($7E:7D51..$7E:95A4)
lifetime: room
confidence: confirmed
tags: [sprites, vram, lru, tiles]
evidence: ["disasm: character sprite bounding box culler and dynamic OBJ VRAM LRU allocation routines in Bank $80 ($80:9033, $80:90F8, $80:91FD) manage tile slot allocations across $7E:7D51..$7E:95A4", "docs: docs/disassembly/entities/sprite-clip-cull.md documents dynamic OBJ VRAM LRU allocation"]
see: [knowledge/wram/tier1_cache_slot_tiles.md, knowledge/wram/tier2_tile_slot_lookup.md, docs/disassembly/entities/sprite-clip-cull.md]
---
6,228-byte dynamic OBJ VRAM LRU allocation lookup table in Bank `$7E` (`$7E:7D51`..`$7E:95A4`).
Tracks sprite tile usage, allocation slots, and frame eviction timestamps for dynamic sprite rendering.
