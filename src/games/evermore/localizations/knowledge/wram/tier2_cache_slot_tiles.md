---
addr: $7E:AA58
name: tier2_cache_slot_tiles
type: u16[96]
tags: [sprites, vram, cache]
confidence: confirmed
evidence: ["disasm: secondary dynamic sprite tile slot table (96 words = 192 bytes: $7E:AA58..$7E:AB17), tracking active pattern ID occupying each secondary VRAM slot", "disasm: audited by obj_tile_lru_cache_reclaim_orphaned ($80:8E52)"]
---
Tier 2 dynamic sprite tile cache slot table (96 words = 192 bytes: $7E:AA58..$7E:AB17), tracking which pattern ID occupies each secondary VRAM slot.
