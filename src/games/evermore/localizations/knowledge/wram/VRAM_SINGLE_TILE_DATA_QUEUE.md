---
addr: $7E:1174
name: VRAM_SINGLE_TILE_DATA_QUEUE
type: u16[64]
tags: [graphics]
confidence: verified
evidence: ["cdl", "disasm"]
---
Buffered 16-bit tile word values to be written to $2118 in VBlank.
