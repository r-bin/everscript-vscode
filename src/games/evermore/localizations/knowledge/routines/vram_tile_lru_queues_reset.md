---
addr: 808F8C
size: 98
end: 808FED
kind: code
category: 🎨
name: vram_tile_lru_queues_reset
title: Resets dynamic sprite tile and macro-tile allocator LRU queues
confidence: confirmed
tags: [graphics, vram, lru, sprites, tiles]
evidence: ["disasm: initializes doubly-linked LRU queues at $7E:9726 / $7E:96A5 and $7E:AB79 / $7E:AB18, zeroes DP $CB..$D2, sets DP $D8 to 0x96, and returns via RTL with 16-bit A/X/Y"]
see: [docs/disassembly/engine-core/macro-tile-allocator.md, docs/disassembly/entities/obj-tile-allocator.md]
---
Resets the dynamic sprite tile LRU cache queue (`$7E:9726` / `$7E:96A5` / `$7E:97A7` / `$7E:97A8`) and the 16x16 macro-tile allocator LRU queue (`$7E:AB79` / `$7E:AB18` / `$7E:AB7A` / `$7E:ABDA` / `$7E:ABDB`), zeroes direct page `$CB..$D2`, sets direct page `$D8` to `0x96`, and returns with 16-bit accumulator and index registers.
