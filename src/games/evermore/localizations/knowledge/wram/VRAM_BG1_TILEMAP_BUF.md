---
addr: $7F:8000
name: VRAM_BG1_TILEMAP_BUF
type: u8[0x2000]
tags: [graphics, map, bank7f]
confidence: verified
evidence: ["disasm: Background Layer 1 tilemap decompression staging buffer before DMA upload to PPU VRAM ($80:BC00)"]
---
Decompressed background Layer 1 tilemap decompression staging buffer before DMA upload to PPU VRAM ($80:BC00).
