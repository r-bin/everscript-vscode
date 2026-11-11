---
addr: 80D91B
size: 25
end: 80D933
kind: code
category: 🎮
name: vram_dma_upload_window_attribute_buffer
title: DMA 128-byte Mode 2 OPT sky scroll table from WRAM $7E:2010..$7E:208F to VRAM $6400 ($80:D91B)
confidence: confirmed
evidence: ["disasm: sets source $7E:2010 into <$26..$28; sets VRAM target $6400 into <$2E; sets size 128 bytes ($0080); uploads via vram_dma_upload_tile_block $80:8650; callers: $80:C95B and $80:CA5E in split-screen Mode 7 flight"]
see: ["routines/vram_dma_upload_tile_block.md","routines/sub_80C95B.md","routines/mode7_camera_matrix_projection_update.md","docs/disassembly/engine-core/mode7-overworld-engine.md"]
tags: ["vram","dma","mode7","flight","opt","ppu"]
---
Transfers the 128-byte (`$0080`) **PPU Mode 2 Offset-Per-Tile (OPT) table** from WRAM `$7E:2010..$7E:208F`
to VRAM word `$6400` (`BG3SC = $64` in `$80:DF51`) via `vram_dma_upload_tile_block` (`$80:8650`):
- **`$7E:2010..$7E:204F`** (64 zero bytes): Row 0 of `BG3` (horizontal OPT offsets = 0).
- **`$7E:2050..$7E:208F`** (64 bytes populated by `$80:CFA9` from `$80:E293,X + $14C8`): Row 1 of `BG3`
  (vertical OPT offsets shearing the 32 columns of the Mode 2 sky layer during banked turns).
