---
addr: 7E2050
size: 64
kind: array
name: MODE7_TRANSFORM_MATRIX_WORDS
title: Mode 2 OPT vertical scroll row (32 words) shearing the sky layer during Mode 7 flight
lifetime: room
confidence: confirmed
tags: [mode7, flight, ppu, opt, vram, dma]
evidence: ["disasm: func_80CFA9 writes 32 words ($7E:2050..$7E:208E) computed from Mode 2 OPT table $80:E293,X + $14C8, and $80:D223 masks column 0 ($7E:2050 &= $01FF)", "disasm: $80:D91B and $80:CA5E DMA 128 bytes ($7E:2010..$7E:208F) to VRAM $6400 (BG3SC = $64 in Mode 2), and $80:DF72 writes $7E:2050 to BG1VOFS ($210E)"]
see: [src/games/evermore/localizations/knowledge/routines/mode7_camera_matrix_projection_update.md, src/games/evermore/localizations/knowledge/routines/vram_dma_upload_window_attribute_buffer.md, docs/disassembly/engine-core/mode7-overworld-engine.md]
---
32-entry array of 16-bit **PPU Mode 2 Offset-Per-Tile (OPT) vertical scroll words** (`$7E:2050..$7E:208F`)
populated by `$80:CFA9` (`mode7_camera_matrix_projection_update`) from ROM table `$80:E293,X + $7E:14C8`
(where `X = $7E:14C6 * 64` is the roll/bank angle row).
- Uploaded during V-Blank (`$80:D91B` / `$80:CA5E`) as the second 64-byte half of the 128-byte DMA from
  `$7E:2010..$7E:208F` to VRAM word `$6400` (`BG3SC = $64` in PPU Mode 2), shearing columns `1..31` of the
  `BG1` sky layer above the horizon scanline.
- Column 0 (`$7E:2050`) has its `$A000` OPT control bits stripped (`AND #$01FF` at `$80:D226`) and is written
  directly to hardware `BG1VOFS` (`$210E`) by the scanline 5 raster IRQ (`$80:DF72`).
