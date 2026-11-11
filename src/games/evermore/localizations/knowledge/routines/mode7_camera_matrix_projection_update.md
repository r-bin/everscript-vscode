---
addr: 80CFA9
end: 80D112
size: 362
kind: code
category: 🧠
name: mode7_camera_matrix_projection_update
title: Populates the 32-column Mode 2 OPT vertical scroll table ($7E:2050..$7E:208E) for the tilted sky layer from $80:E293,X + $14C8
confidence: confirmed
tags: [mode7, flight, ppu, opt, sky]
evidence: ["disasm: $80:CFA9 computes X = $14C6 << 6 and unrolls 32 16-bit additions LDA $80:E293+2n,X; ADC $14C8; STA $7E:2050+2n ($7E:2050..$7E:208E), falling through to $80:D113", "disasm: $80:D91B and $80:CA5E DMA 128 bytes ($7E:2010..$7E:208F) to VRAM $6400, which $80:DF51 binds as BG3SC = $64 in PPU Mode 2 (BGMODE = $12)"]
see: [routines/row_table_low_bytes_from_bank_b0.md, routines/vram_dma_upload_window_attribute_buffer.md, routines/install_raster_irq_handler_at_df51.md, docs/disassembly/engine-core/mode7-overworld-engine.md, docs/vanilla-bugs/mode7-bank-b0-oob-read.md]
---
Computes the 32-column PPU Mode 2 Offset-Per-Tile (OPT) vertical scroll row in WRAM (`$7E:2050..$7E:208E`)
used to shear the `BG1` sky layer when banking left or right during split-screen Mode 7 flight.

1. Shifts the aircraft roll/bank tilt index `$7E:14C6` (`0..30`, neutral `15` / `$0F`) left by 6
   (`X = $14C6 * 64`) to select a 32-word row from ROM table `$80:E293` (`$80:E293..$80:EA52`).
2. Each word in `$80:E293` carries Mode 2 OPT flags `$A000` (bit 15 = vertical scroll, bit 13 = enable
   for `BG1`) plus a signed per-column vertical offset for that bank angle.
3. Unrolls 32 16-bit additions (`LDA $80:E293+2n,X; ADC $14C8; STA $7E:2050+2n`), adding the pitch-derived
   sky vertical offset `$7E:14C8` (`($3C - $14B8) & $7F`).
4. Falls through to `$80:D113` (`row_table_low_bytes_from_bank_b0`), which copies 32 bytes from `$B0:E293,X`
   into unread WRAM `$7E:2090..$7E:20AF` and masks column 0 (`$7E:2050 &= $01FF`) for hardware `BG1VOFS`.

## Callers
- `$80:BC7A` (via `$80:CFA5`, initial neutral tilt `$14C6 = 15`)
- `$80:CEA2`, `$80:CEB4`, `$80:CEC4` (called from `$80:CE35` when pitch `$14B8` or roll `$14C6` changes)
