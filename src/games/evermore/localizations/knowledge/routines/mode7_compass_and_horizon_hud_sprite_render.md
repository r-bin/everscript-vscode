---
addr: 80D23A
end: 80D507
size: 718
kind: code
category: 🧠
name: mode7_compass_and_horizon_hud_sprite_render
title: Updates Y coordinates of the 64 tilted horizon seam sprites ($7E:ACBF..$7E:ADDD) from pitch $14B8 and roll table $80:F293
confidence: confirmed
tags: [mode7, flight, sprite, oam, horizon]
evidence: ["disasm: $80:D23A computes 4 row base Y values ($14B8 + $1D, +$2D, +$3D, +$4D), indexes $80:F293 by X = $14C6 << 5, and unrolls 64 byte stores to OAM Y bytes $7E:ACBF..$7E:ADDD (stride 4)"]
see: [routines/hud_window_oam_setup.md, routines/mode7_flight_hud_indicator_oam_formatter.md, docs/disassembly/engine-core/mode7-overworld-engine.md]
---
Computes the vertical (`Y`) screen coordinates for the **64 16×16 priority-3 horizon seam sprites**
(4 rows × 16 columns in Low OAM slots `56..119`, `$7E:ACBE..$7E:ADDD`) that mask the horizontal
scanline switch from PPU Mode 2 (`$12`, sky) to PPU Mode 7 (`$07`, ground) at `Y = 61 + $7E:14B8`.

1. Computes 4 vertical row base offsets from pitch/altitude `$7E:14B8`:
   - `$00 = $14B8 + $1D` (Row 0, `Y = 29 + $14B8`)
   - `$02 = $14B8 + $2D` (Row 1, `Y = 45 + $14B8`)
   - `$04 = $14B8 + $3D` (Row 2, `Y = 61 + $14B8`, directly straddling the Mode 2/Mode 7 raster IRQ split)
   - `$06 = $14B8 + $4D` (Row 3, `Y = 77 + $14B8`)
2. Indexes the 31-row horizon tilt table at **`$80:F293`** (`$80:F293..$80:F672`) by `X = $7E:14C6 << 5`
   (roll angle `0..30`, 32 bytes per row) and adds each column's signed vertical tilt offset to `$00..$06`,
   clamping off-screen sprites to `$F0` and writing all 64 OAM Y bytes (`$7E:ACBF, $ACC3, ..., $ADDD`).

## Callers
- `$80:D22D` (`hud_window_oam_setup`)
- `$80:C95B` (`$80:CA75` per-frame split-screen Mode 7 loop)
