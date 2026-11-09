---
addr: $7E:ABDE
name: LOW_OAM_TABLE_BUF
type: u8[512]
tags: [sprites, oam, widescreen, widescreen.oam]
confidence: verified
evidence: ["disasm: Low OAM staging buffer (128 hardware sprites × 4 bytes = 512 bytes: $7E:ABDE..$7E:ADDD: X low, Y, tile number, attributes); uploaded to SNES OAM via DMA in VBlank"]
---
Low OAM staging buffer (128 hardware sprites × 4 bytes = 512 bytes: $7E:ABDE..$7E:ADDD) uploaded to SNES OAM during VBLANK.
