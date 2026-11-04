---
addr: $7E:165A
name: VRAM_MACROTILE_DMA_DEST_TAIL
type: u16[7]
tags: [ppu, sprites, dma]
confidence: verified
evidence: ["disasm", "cdl"]
---
PPU Subsystem: Tail array of 7 VRAM destination word addresses for dynamic 16x16 sprite macro-tile DMA upload queue (slots 15..21, $7E:165A..$7E:1667; allocated by $80:9734, uploaded to VRAM during NMI at $80:82CA).

