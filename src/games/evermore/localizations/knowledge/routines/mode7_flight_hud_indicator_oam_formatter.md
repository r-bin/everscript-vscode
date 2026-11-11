---
addr: 80D58B
end: 80D762
size: 472
kind: code
category: 🧠
name: mode7_flight_hud_indicator_oam_formatter
title: Updates tile indices of the 64 tilted horizon seam sprites ($7E:ACC0..$7E:ADDE) from roll tables $80:EA93..$80:F093
confidence: confirmed
tags: [mode7, flight, sprite, oam, horizon]
evidence: ["disasm: $80:D58B indexes 4 ROM tables ($80:EA93, $80:EC93, $80:EE93, $80:F093) by X = $14C6 << 4 and unrolls 64 byte stores to OAM tile bytes $7E:ACC0..$7E:ADDE (stride 4)"]
see: [routines/hud_window_oam_setup.md, routines/mode7_compass_and_horizon_hud_sprite_render.md, docs/disassembly/engine-core/mode7-overworld-engine.md]
---
Writes pre-tilted 16×16 tile numbers into the **64 horizon seam sprites** in Low OAM slots `56..119`
(`$7E:ACC0..$7E:ADDE`, stride 4) as a function of the aircraft's roll/bank angle `$7E:14C6` (`0..30`, neutral `15`).

Indexes four 31-row × 16-byte ROM lookup tables by `X = $7E:14C6 << 4`:
- **Row 0 (`$7E:ACC0..$7E:ACFC`)**: `$80:EA93,X` (`$80:EA93..$80:EC72`)
- **Row 1 (`$7E:AD00..$7E:AD3C`)**: `$80:EC93,X` (`$80:EC93..$80:EE72`)
- **Row 2 (`$7E:AD40..$7E:AD7C`)**: `$80:EE93,X` (`$80:EE93..$80:F072`)
- **Row 3 (`$7E:AD80..$7E:ADBC`)**: `$80:F093,X` (`$80:F093..$80:F272`)

## Callers
- `$80:D22D` (`hud_window_oam_setup`)
- `$80:C95B` (`$80:CA78` per-frame split-screen Mode 7 loop)
