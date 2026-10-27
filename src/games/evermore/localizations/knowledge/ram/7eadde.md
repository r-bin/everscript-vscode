---
addr: 7EADDE
size: 32
kind: array
name: HIGH_OAM_TABLE_BUF
title: High OAM staging buffer (32 bytes = 128 sprites × 2 bits)
lifetime: frame
confidence: verified
tags: [sprites, oam, rendering]
evidence: ["disasm: func_C09040+$01EE advances $D5 and writes 2-bit X9/size flag into $7E:ADDE,x", "disasm: NMI DMA transfers 32 bytes from $7E:ADDE following Low OAM transfer"]
---
CPU staging buffer for SNES High OAM (32 bytes total).
Each byte holds attributes for 4 sprites (2 bits per sprite):
- Bit 0: 9th bit (MSB) of horizontal X position (for values > 255 or off-screen left)
- Bit 1: Sprite size toggle (8x8 vs 16x16 / 32x32 based on OBSEL)
Transferred to PPU OAM via DMA immediately after Low OAM during VBlank.
