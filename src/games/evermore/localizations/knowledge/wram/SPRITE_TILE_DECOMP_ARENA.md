---
addr: $7E:7351
name: SPRITE_TILE_DECOMP_ARENA
type: u8[2560]
tags: [sprites, vram, graphics]
confidence: confirmed
evidence: ["disasm: bank_C0.asm lines 4376-4426 write decompressed 128-byte 16x16 4bpp tile frames into $7E:72D1 + N*$80 up to $7E:7D50", "disasm: DMA channel commits decompressed tile frames into VRAM OBJ pattern memory during VBLANK"]
---
Dynamic sprite tile decompression and assembly staging arena (20 tiles × 128 bytes per 16x16 4bpp tile: $7E:7351..$7E:7D50) queued for VRAM upload.
