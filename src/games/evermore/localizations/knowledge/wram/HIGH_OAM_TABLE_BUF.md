---
addr: $7E:ADDE
name: HIGH_OAM_TABLE_BUF
type: u8[32]
tags: [sprites, oam, widescreen, widescreen.oam]
confidence: verified
evidence: ["disasm: High OAM staging buffer (32 bytes = 128 sprites × 2 bits: $7E:ADDE..$7E:ADFD: bit 0 = 9th bit of X, bit 1 = sprite size 8x8 vs 16x16/32x32); uploaded via DMA in VBlank"]
---
High OAM staging buffer (32 bytes = 128 sprites × 2 bits: $7E:ADDE..$7E:ADFD) uploaded to SNES OAM during VBLANK.

## Widescreen notes

The slice emitters ($80:90F8, $80:91FD) set the X high bit only when screen X is negative (`bit $17` → N); a sprite at X ≥ 256 would get X8 = 0 and wrap to the left edge. Their clip window keeps X in [−7, 255] / [−15, 255], so vanilla never emits X ≥ 256 (asm read 2026-11-09).
