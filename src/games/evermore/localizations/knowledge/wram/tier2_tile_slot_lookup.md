---
addr: $7E:97A9
name: tier2_tile_slot_lookup
type: u8[4783]
tags: [sprites, vram, cache]
confidence: confirmed
evidence: ["disasm: secondary dynamic sprite tile frame direct lookup table mapping frame/tile IDs to 96-slot secondary cache", "disasm: paired with tier1_tile_slot_lookup ($7E:7D51) for multi-tier dynamic VRAM tile caching"]
---
Tier 2 dynamic sprite tile frame direct lookup table ($7E:97A9..$7E:AA57, 4783 bytes), mapping pattern IDs to secondary cache slot indices.
