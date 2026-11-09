---
addr: $7F:8000
name: VRAM_BG1_TILEMAP_BUF
type: u8[0x2000]
tags: [graphics, map, bank7f, widescreen, widescreen.streaming]
confidence: verified
evidence: ["disasm: Background Layer 1 tilemap decompression staging buffer before DMA upload to PPU VRAM ($80:BC00)"]
---
Decompressed background Layer 1 tilemap decompression staging buffer before DMA upload to PPU VRAM ($80:BC00).

## Widescreen notes

The full-window upload `$90:93AA` first DMA-fills the whole 32x32 BG tilemap from the fixed word at `$7F:8000` (DMAP `$09`, 2 KB), then draws only `$0FAC` x 15 cells. Margin columns are blank right after a room load (asm read 2026-11-09).
