---
addr: $7E:96A5
name: OBJ_TILE_LRU_PREV
type: u8[128]
tags: [sprites, vram, cache]
confidence: verified
evidence: ["disasm: OBJ 8x8 tile cache, prev links (128 bytes: $7E:96A5..$7E:9724) for primary 128-slot sprite tile cache; audited by $80:8E52"]
---
OBJ 8x8 tile cache reverse link array (128 slots: $7E:96A5..$7E:9724) mapping predecessor in LRU eviction queue.
