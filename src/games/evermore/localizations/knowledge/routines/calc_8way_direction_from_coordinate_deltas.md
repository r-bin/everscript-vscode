---
addr: 8FAA05
size: 76
end: 8FAA50
kind: code
category: 🗺️
name: calc_8way_direction_from_coordinate_deltas
title: 8-way directional enum converter from signed coordinate deltas ($8F:AA05)
confidence: confirmed
tags: [math, direction, movement]
reconstructed_c: reconstructed-c/8F/8FAA05_calc_8way_direction_from_coordinate_deltas.c
evidence: ["disasm: evaluates signed delta X (DP $12) and delta Y (DP $14); compares absolute values |X| and |Y|; maps to 8-way directional enum: 0=N, 2=NE, 4=E, 6=SE, 8=S, 10=SW, 12=W, 14=NW; returns code in A; callers: $8F:AB6E", "g1: passed (2/2 reference replay, 32/32 fuzzed, mutation caught)"]
see: [routines/calc_8way_direction_with_random_jitter.md]
---
Converts signed 16-bit coordinate deltas (`$12` = dx, `$14` = dy) into an 8-way directional enum (0 = North, 2 = Northeast, 4 = East, 6 = Southeast, 8 = South, 10 = Southwest, 12 = West, 14 = Northwest) based on quadrant and absolute magnitude comparison $|X| 	ext{ vs } |Y|$.
