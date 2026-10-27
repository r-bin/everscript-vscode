---
addr: 7EABDE
size: 512
kind: array
name: LOW_OAM_TABLE_BUF
title: Low OAM staging buffer (128 hardware sprites × 4 bytes)
lifetime: frame
confidence: verified
tags: [sprites, oam, rendering]
evidence: ["disasm: func_C09040 writes sprite X, Y, tile index, and attribute byte to $7E:ABDE,x (x = 0, 4, ... 508)", "disasm: NMI DMA transfers $0200 bytes from $7E:ABDE to SNES OAMADDL"]
---
The main CPU staging buffer for SNES Low OAM:
Each sprite occupies 4 bytes:
- Byte 0: X coordinate (bits 0-7)
- Byte 1: Y coordinate
- Byte 2: Starting tile number
- Byte 3: Attribute flags (palette, priority, h-flip, v-flip)
Transferred to PPU OAM via DMA channel at the start of VBlank.
