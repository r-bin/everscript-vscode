---
addr: 7E2090
size: 32
kind: array
name: MODE7_PERSPECTIVE_SCALE_BYTES
title: Mode 7 perspective scaling factors table
lifetime: room
confidence: confirmed
tags: [mode7, flight, ppu, hdma]
evidence: ["disasm: func_80D113 unrolled byte-copy loop (SEP #$20; PEA $B090; PLB; PLB) writes 32 bytes from $E293,X into $7E:2090..$7E:20AF"]
see: [src/games/evermore/localizations/knowledge/routines/row_table_low_bytes_from_bank_b0.md]
---
32-byte array of perspective step scaling factors loaded from ROM bank `$90` / `$80` (`$E293, X`) into `$7E:2090`..`$7E:20AF`.
- Populated by `func_80D113` following word calculation in `func_80CFA9`.
- Provides per-scanline fine zoom increments for Mode 7 ground plane distortion.
