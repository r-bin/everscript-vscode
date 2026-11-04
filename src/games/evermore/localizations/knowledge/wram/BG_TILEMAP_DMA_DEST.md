---
addr: $7E:15D6
name: BG_TILEMAP_DMA_DEST
type: u16[18]
tags: [graphics, map]
confidence: verified
evidence: ["cdl", "disasm: $80:829C, $80:A4B5, $80:8268"]
---
PPU Subsystem: VRAM destination word addresses for 18 BG tilemap row/col DMA transfers ($7E:15D6..$7E:15F9, 36 bytes; 18 words). Populated during metatile scroll row/column updates and committed during VBlank NMI DMA.
