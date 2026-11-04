---
addr: $7E:ADDE
name: HIGH_OAM_TABLE_BUF
type: u8[32]
tags: [sprites, oam]
confidence: verified
evidence: ["disasm: High OAM staging buffer (32 bytes = 128 sprites × 2 bits: $7E:ADDE..$7E:ADFD: bit 0 = 9th bit of X, bit 1 = sprite size 8x8 vs 16x16/32x32); uploaded via DMA in VBlank"]
---
High OAM staging buffer (32 bytes = 128 sprites × 2 bits: $7E:ADDE..$7E:ADFD) uploaded to SNES OAM during VBLANK.
