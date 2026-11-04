---
addr: $7E:6187
name: SPRITE_CGRAM_SHADOW
type: u16[16]
tags: [cgram, palette, sprites]
confidence: verified
evidence: ["disasm: sprite palette 0 shadow buffer (16 colors = 32 bytes: $7E:6187..$7E:61A6) DMA-copied to SNES CGRAM during VBLANK"]
---
Sprite palette 0 shadow buffer DMA-copied to SNES CGRAM during VBLANK (16 colors × 2 bytes = 32 bytes).
