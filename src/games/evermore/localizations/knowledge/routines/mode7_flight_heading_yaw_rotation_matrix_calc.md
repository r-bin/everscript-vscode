---
addr: 80D934
end: 80D9F4
size: 193
kind: code
category: 🧠
name: mode7_flight_heading_yaw_rotation_matrix_calc
title: Populates per-scanline Mode 7 perspective matrix buffers $7F:D000 (M7A/M7B) and $7F:D380 (M7C/M7D) for HDMA channels 6 & 7
confidence: confirmed
tags: [mode7, flight, hdma, ppu, math]
evidence: ["disasm: $80:D934 computes sin/cos ($B5/$B7) of yaw ($14BA >> 3) via $80:DA6B and $80:F693, then loops from scanline X = (60 + $14B8) * 4 to $037C (scanline 223), multiplying 1/z scale words from $7F:0000,Y via $80:AD28 and writing M7A/M7B to $7F:D000,X and M7C/M7D to $7F:D380,X"]
see: [routines/mode7_flight_shadow_projection_geometry_calc.md, docs/disassembly/engine-core/mode7-overworld-engine.md]
---
Populates the per-scanline Mode 7 affine matrix buffers in Bank `$7F` (`$7F:D000..$7F:D6FF`) streamed to
`M7A..M7D` (`$211B..$211E`) by HDMA channels 6 and 7 during split-screen Mode 7 flight (`$80:C95B`).

1. Computes 8-bit yaw angle `$BB = ($7E:14BA >> 3) & $FF` and looks up `sin(yaw)` (`$B5`) and `cos(yaw)`
   (`$B7`) from `$80:F693` using quadrant reducer `$80:DA6B`.
2. Starts at the horizon scanline index `X = (60 + $7E:14B8) * 4` and `1/z` table index
   `Y = ($3C - $7E:14B8) * 2` in `$7F:0000` (decompressed at scene start by `$80:C0D0`).
3. For each scanline down to 223 (`X = $037C`), multiplies the scanline's `1/z` scale word (`$7F:0000,Y`)
   by `cos` and `sin` via `$80:AD28` (`math_fixed_point_sin_cos_multiply`) and stores:
   - `$7F:D000,X` = `M7A` (`+cos * scale`), `$7F:D002,X` = `M7B` (`+sin * scale`)
   - `$7F:D380,X` = `M7C` (`-sin * scale`), `$7F:D382,X` = `M7D` (`+cos * scale`)

## Callers
- `$80:C95B` (`sub_80C95B` initialization and `$80:CA58` per-frame loop)

## Callees
- `$80:DA6B` (`angle_to_first_quadrant_index`)
- `$80:AD28` (`math_fixed_point_sin_cos_multiply`)
