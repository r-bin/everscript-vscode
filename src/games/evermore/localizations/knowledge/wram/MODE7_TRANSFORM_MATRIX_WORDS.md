---
addr: 7E2050
size: 64
kind: array
name: MODE7_TRANSFORM_MATRIX_WORDS
title: Mode 7 perspective transformation scanline matrix table
lifetime: room
confidence: confirmed
tags: [mode7, flight, ppu, hdma]
evidence: ["disasm: func_80CFA9 writes 32 words ($7E:2050..$7E:208E) computed from trig table $80:E293,X + $14C8", "disasm: func_80D113 documents $7E2050+ table population before byte pass"]
see: [src/games/evermore/localizations/knowledge/rom/80cfa9.md, src/games/evermore/localizations/knowledge/rom/80d113.md]
---
32-entry array of 16-bit perspective scaling words computed dynamically by `func_80CFA9` for Mode 7 scanline projection.
- Derived by indexing ROM matrix tables (`$80:E293, X`) using aircraft heading `$14C6` and adding altitude focal distance `$14C8`.
- Consumed by HDMA channels or PPU matrix update routines to set $211B/$211C matrix parameters per scanline band.
