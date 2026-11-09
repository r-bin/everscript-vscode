---
addr: 8FA933
size: 8
end: 8FA93A
kind: code
category: 🧠
name: spawn_eval_tile_plane_elevation
title: Evaluate tile collision flag and plane elevation for character spawning
confidence: confirmed
tags: [entities, physics, collision]
reconstructed_c: reconstructed-c/8F/8FA933_spawn_eval_tile_plane_elevation.c
evidence: ["disasm: called at $8C:DD19 by all script spawn handlers (opcodes 0x3C, 0xA2, 0xBA, 0xC2) with target (X, Y) in DP $46, $48; calls $90:9815 to sample tile collision bits, extracts plane bits (mask 0x0030) or sets elevated plane bit 0x0040 if collision bit 13 is set, storing to DP $44", "recomp: clean C in docs/disassembly/script-vm/opcode-spawning.md", "g1: passed (29/29 reference replay, 445/445 fuzzed, mutation caught)"]
see: [routines/script_op_a2_spawn_at.md, routines/script_op_3c_spawn.md, routines/projectile_spawn_master.md]
---
Evaluates the initial Z/plane elevation for an entity or projectile spawned at world coordinates `(X, Y)`:
- Loads `X = DP $46`, `Y = DP $48`.
- Calls tile collision lookup subroutine `$90:9815` to sample tile flags.
- Inspects bit 13 (`0x2000`):
  - If bit 13 is clear: masks `val & 0x0030` and writes initial plane to `DP $44`.
  - If bit 13 is set: executes `$8F:A924` to compute `(val & 0x0030) | 0x0040` into `DP $44`.
- Full clean C decompilation: `docs/disassembly/script-vm/opcode-spawning.md`.
