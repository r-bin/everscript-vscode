---
addr: $7E:2010
name: AUDIO_ATTEN_TABLE_ALIGN_PAD
type: u8[64]
tags: [audio, mode7, flight, ppu, opt, vram, dma]
confidence: confirmed
evidence: ["disasm: $80:D91B and $80:CA5E DMA 128 bytes ($0080) starting at $7E:2010 ($7E:2010..$7E:208F) to VRAM word $6400 (BG3SC = $64 in Mode 2)"]
see: [src/games/evermore/localizations/knowledge/routines/vram_dma_upload_window_attribute_buffer.md, src/games/evermore/localizations/knowledge/wram/MODE7_TRANSFORM_MATRIX_WORDS.md, docs/disassembly/engine-core/mode7-overworld-engine.md]
---
64-byte zeroed buffer (`$7E:2010..$7E:204F`) that serves as **Row 0 (horizontal Offset-Per-Tile = 0)** of the
128-byte PPU Mode 2 OPT table (`$7E:2010..$7E:208F`) uploaded via DMA (`$80:D91B` and `$80:CA5E`) to VRAM
word `$6400` (`BG3SC = $64`) during split-screen Mode 7 flight (`$80:C95B`). Immediately followed at
`$7E:2050..$7E:208F` by Row 1 (the 32 vertical OPT scroll words populated by `$80:CFA9`).
