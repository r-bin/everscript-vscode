---
addr: 8CAFFC
kind: code
category: 🗺️
name: mode7_tilemap_row_dma_stream
title: Mode 7 transformation matrix setup and tilemap row DMA streamer ($8C:AFFC)
confidence: confirmed
evidence: ["disasm: writes input word into M7A matrix register $211B twice and sets M7B $211C = 1; multiplies row offset using $4202; configures DMA channel 1: mode $81, target PPU Mode 7 product register $2134, source $7F:C800+(A*2), count DP $06*2; triggers DMA via $420B; loops across Y rows advancing by $40; callers: $8C:AFE6, $8D:9B2A"]
see: [ram/7fc800.md]
tags: [mode7, ppu, dma]
---
Programs the SNES PPU Mode 7 transformation matrix and streams transformed tilemap scanlines to PPU registers via DMA. Configures matrix scaling factors in `$211B` (`M7A`) and `$211C` (`M7B`), calculates row addresses via hardware multiplier `$4202`, and executes DMA channel 1 transfers from buffer `$7F:C800` into Mode 7 data register `$2134`, looping across `Y` rows with a 64-byte (`$40`) stride.
