---
addr: 80D9F5
end: 80DA6A
size: 118
kind: code
category: 🧠
name: mode7_flight_shadow_projection_geometry_calc
title: Builds indirect HDMA tables at $7F:D700..$7F:D70D and arms HDMA channels 6 & 7 for M7A/M7B ($211B) and M7C/M7D ($211D)
confidence: confirmed
tags: [mode7, flight, hdma, ppu]
evidence: ["disasm: $80:D9F5 writes two 7-byte indirect HDMA tables at $7F:D700..$7F:D706 ($F0 lines at $D000, $F0 lines at $D1C0, $00) and $7F:D707..$7F:D70D ($F0 lines at $D380, $F0 lines at $D540, $00), configures $4360..$4367 (Ch 6 -> $211B/$211C) and $4370..$4377 (Ch 7 -> $211D/$211E), and sets $72 = $C0"]
see: [routines/mode7_flight_heading_yaw_rotation_matrix_calc.md, docs/disassembly/engine-core/mode7-overworld-engine.md]
---
Builds the indirect HDMA command tables in `$7F:D700..$7F:D70D` and arms **HDMA Channels 6 and 7** to
stream per-scanline Mode 7 matrix coefficients (`M7A..M7D`) into `$211B..$211E` during split-screen Mode 7 flight.

1. Writes two 7-byte indirect HDMA descriptors in Bank `$7F`:
   - **`$7F:D700..$7F:D706`**: `$F0` (112 continuous lines) at `$7F:D000`, `$F0` (112 continuous lines) at `$7F:D1C0`, `$00` (end).
   - **`$7F:D707..$7F:D70D`**: `$F0` (112 continuous lines) at `$7F:D380`, `$F0` (112 continuous lines) at `$7F:D540`, `$00` (end).
2. Configures **HDMA Channel 6** (`$4360 = $43` indirect 2-register write-twice, `BBAD6 = $1B` → `$211B`/`$211C` `M7A`/`M7B`, `A1T6 = $7F:D700`, `DAS6B = $7F`) and **HDMA Channel 7** (`$4370 = $43`, `BBAD7 = $1D` → `$211D`/`$211E` `M7C`/`M7D`, `A1T7 = $7F:D707`, `DAS7B = $7F`).
3. Sets WRAM HDMA shadow **`$7E:0072 = $C0`** (channels 6 and 7), which the NMI handler writes to `$420C`.

## Callers
- `$80:C95B` (`sub_80C95B`)
