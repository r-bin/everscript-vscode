---
addr: 7E14C6
size: 2
kind: var
name: MODE7_AIRCRAFT_YAW_HEADING
title: Mode 7 aircraft flight yaw heading angle index
lifetime: room
confidence: confirmed
tags: [mode7, flight, camera, math]
evidence: ["disasm: func_80CFA9 reads $14C6 and multiplies by 64 (ASL x6) to index trig table $80:E293,X", "disasm: func_80D58B reads $14C6 and multiplies by 16 (ASL x4) to select aircraft sprite frames at $80:EAA2", "disasm: func_80BE09 initializes $14C6 = $000F (facing north)"]
see: [src/games/evermore/localizations/knowledge/routines/mode7_camera_matrix_projection_update.md, src/games/evermore/localizations/knowledge/routines/mode7_flight_hud_indicator_oam_formatter.md]
---
Current compass heading angle index (0..31) for Mode 7 flight navigation (e.g. windwalker / flying machine sequences).
- Initialized to `$000F` (facing north) on flight entry by `func_80BE09`.
- Multiplied by 64 in `func_80CFA9` to index 32-entry perspective transformation tables in ROM (`$80:E293, X`).
- Multiplied by 16 in `func_80D58B` to select corresponding rotated aircraft sprite graphics for the OAM staging buffer.
