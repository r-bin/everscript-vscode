---
addr: 808E52
size: 72
end: 808E99
kind: code
category: 🎨
name: obj_tile_lru_cache_reclaim_orphaned_slots
title: OBJ sprite tile LRU cache orphan auditor and free list restorer ($80:8E52)
confidence: confirmed
evidence: ["disasm: switches DBR to $7E; iterates 128 slots in $7E:96A5 (OBJ_TILE_LRU_PREV); for each unlinked slot where self-index matches prev, splices slot back onto free list head $7E:9725 and updates $7E:9727; repeats for 96 slots in second LRU cache at $7E:AB18 with free list head $7E:AB78 and links at $7E:AB7A; caller is per_frame_map_effects ($90:9839)"]
see: [knowledge/wram/OBJ_TILE_LRU_PREV.md, knowledge/wram/OBJ_TILE_LRU_NEXT.md, routines/per_frame_map_effects.md]
tags: [sprites, vram, lru, oam]
---
Audits both active sprite tile LRU caches in WRAM and restores unlinked or orphaned tile slots to their respective free lists. Scans all 128 slots in the primary OBJ tile cache (`$7E:96A5`, `OBJ_TILE_LRU_PREV`), splicing orphaned slots onto free list head `$7E:9725` with forward links at `$7E:9727`. Performs an identical sweep across the 96 slots of the secondary tile cache at `$7E:AB18`, linking freed slots back to head `$7E:AB78` and forward list `$7E:AB7A`.
