---
addr: $7E:684D
name: HDMA_WINDOW_INDIRECT_TABLE
type: u8[28]
tags: [hdma, ppu, window]
confidence: verified
evidence: ["disasm: HDMA Channel 5 indirect table header (28 bytes: 7 scanline entries × 4 bytes: $7E:684D..$7E:6868) for PPU Window 1 masking ($2126 WH0; $91:C7F5)"]
---
HDMA Channel 5 indirect table header for PPU Window 1 masking ($7E:684D..$7E:6868).
