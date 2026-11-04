---
addr: $7E:9727
name: OBJ_TILE_LRU_NEXT
type: u8[130]
tags: [sprites, vram, cache]
confidence: verified
evidence: ["disasm: OBJ 8x8 tile cache, forward links (130 bytes: $7E:9727..$7E:97A8) for 128 dynamic OBJ tile slots plus head/tail sentinels"]
---
OBJ 8x8 tile cache forward link array (130 bytes: $7E:9727..$7E:97A8) chaining 128 dynamic OBJ tile slots in LRU order.
