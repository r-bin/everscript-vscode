---
addr: 8C9DE7
size: 19
end: 8C9DF9
kind: code
category: 🎮
name: dialogue_window_init_line_wrap_table
title: Initialize dialogue line wrap breakpoint lookup table in WRAM ($8C:9DE7)
confidence: verified
evidence:
  - "[\"disasm: loops 16 times (X=15 down to 0); fills $7E:2000,X with decreasing values starting at $FF stepping by -$10 ($FF, $EF, $DF..); callers: text init $80:8CC9, menu init $8D:B492\"]"
  - "Reconstructed in `reconstructed-c/8C/8C9DE7_dialogue_window_init_line_wrap_table.c` (SOE_BIND); passes Gate G1 differential verification (3/3 reference states, 48/48 fuzzed states, mutation caught: yes, 69 / 3035 ROM/C instructions per call)."
see: ["routines/gameplay_session_subsystems_init.md","routines/sram_compute_checksum.md"]
tags: ["dialogue", "font", "wram", "init", reconstructed-c, g1-pass]
---
Initializes dialogue line-wrap breakpoint buffer `$7E:2000..$7E:200F` with decreasing multiples of 16 (`$FF`, `$EF`, `$DF` down to `$0F`). Called during text subsystem boot (`$80:8CC9`) and menu init (`$8D:B492`).
