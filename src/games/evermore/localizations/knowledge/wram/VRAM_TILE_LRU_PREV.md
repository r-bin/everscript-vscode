---
addr: $7E:AB18
name: VRAM_TILE_LRU_PREV
type: u8[96]
tags: [sprites, vram, cache]
confidence: confirmed
evidence: ["disasm: obj_tile_lru_cache_reclaim_orphaned ($80:8E7A) iterates 96 slots ($5F down to 0) checking CMP $AB18,X and linking to head $AB78", "disasm: reverse link array for 96-slot secondary dynamic VRAM tile LRU cache ($7E:AB18..$7E:AB77)"]
---
Reverse link array for secondary 96-slot dynamic VRAM sprite tile LRU cache ($7E:AB18..$7E:AB77).
