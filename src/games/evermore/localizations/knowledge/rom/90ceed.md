---
addr: 90CEED
end: 90CF39
kind: code
category: 🧠
name: sprite_vram_3slot_cache_alloc
title: Query 3-slot associative sprite VRAM cache and allocate on miss
confidence: confirmed
tags: [sprites, vram, cache]
evidence: ["disasm: compares asset ID with $1288 (slot 0), $128A (slot 1), $128C (slot 2); returns slot offset 0, 2, or 4 on hit; on miss searches for empty slot (0), saves asset ID, and invokes $90:CFB8 to queue DMA transfer"]
see: [docs/disassembly/entities/sprite-slicer.md, rom/90cf3a.md, rom/90cfb8.md]
---
Maintains a 3-slot associative cache of active sprite graphics assets in VRAM at `$7E:1288`, `$7E:128A`,
and `$7E:128C`. On a cache hit, returns the slot index immediately; on a cache miss, assigns an empty slot
and enqueues the tile graphics for streaming to VRAM via DMA.
Full disassembly and clean C reconstruction: `docs/disassembly/entities/sprite-slicer.md`.
