---
addr: 8FA9B1
size: 40
end: 8FA9D8
kind: code
category: 🧠
name: elevation_dominant_axis_direction
title: Pick one of four cardinal direction codes by dominant vector axis
confidence: verified
tags: [maps, math, vector, heading, reconstructed-c, g1-pass]
evidence: ["reconstructed-c/8F/8FA9B1_elevation_dominant_axis_direction.c passes Gate G1 (32/32 reference states, 512/512 fuzzed, mutation caught)"]
see: [routines/elevation_compass_direction_resolve.md, routines/elevation_vector_shear_step.md]
---
Converts a signed byte delta vector (dx in DP `$12`, dy in DP `$13`) into one of four cardinal direction codes based on the dominant axis magnitude:
1. Computes `abs(dx)` (if negative, `(dx - 1) ^ 0xFF`) and writes to scratch register DP `$14`.
2. Computes `abs(dy)` into the accumulator.
3. Compares `abs(dy)` with `abs(dx)` (`CMP $14`):
   - If `abs(dy) >= abs(dx)` (vertical dominant or tie, carry set):
     Inspects sign of delta Y (`LDA $13`):
     - If negative (dy < 0): returns `$00` (North).
     - If positive (dy >= 0): returns `$08` (South).
   - If `abs(dy) < abs(dx)` (horizontal dominant, carry clear):
     Inspects sign of delta X (`LDA $12`):
     - If negative (dx < 0): returns `$0C` (West).
     - If positive (dx >= 0): returns `$04` (East).
4. Leaves A low byte = the cardinal direction code, sets N and Z flags accordingly, preserves Carry from the comparison, and returns with RTL in 8-bit accumulator mode.

## Callers
- Navigation, elevation ramp resolution, and entity directional alignment routines.
