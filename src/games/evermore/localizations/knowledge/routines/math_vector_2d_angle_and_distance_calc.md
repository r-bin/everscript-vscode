---
addr: 80AEAC
end: 80B01C
size: 369
kind: code
category: 🧠
name: math_vector_2d_angle_and_distance_calc
title: Computes 8-bit directional angle (0..255) from signed X and Y coordinate displacements
confidence: verified
tags: [math, angle, trig, hardware-divider]
evidence: ["G1 differential testing: 35/35 reference states, 559/559 fuzzed states match ROM, mutation caught"]
---
Computes 8-bit directional angle (0..255) from signed delta-X (`$02`) and delta-Y (`$04`).

1. Determines absolute magnitude: `|DX| -> $12`, `|DY| -> $14`.
2. Compares `|DX|` and `|DY|` and checks delta signs to determine octant (0..7).
3. Uses hardware unsigned divider (`$4204` / `$4206` -> `$4214`) to compute `64 * min(|DX|, |DY|) / max(|DX|, |DY|)`.
4. Indexes 64-entry arctangent table at ROM `$80:8B25` (or `$C0:8B25`).
5. Folds/offsets the table angle into the appropriate octant:
   - Octant 0: `angle`
   - Octant 1: `0x40 - angle`
   - Octant 2: `0x40 + angle`
   - Octant 3: `0x80 - angle`
   - Octant 4: `0xFF80 + angle`
   - Octant 5: `0xFFC0 - angle`
   - Octant 6: `0xFFC0 + angle`
   - Octant 7: `-angle`
6. Restores entry DB via PLB. Returns 8-bit angle in A.

## Parameters & Variables
- Direct Page `$02`: Signed 16-bit delta-X.
- Direct Page `$04`: Signed 16-bit delta-Y.
- Direct Page `$12`: Magnitude of delta-X (`|DX|`).
- Direct Page `$14`: Magnitude of delta-Y (`|DY|`).
- Direct Page `$16`: Angle computed from lookup table.

## Callers
- `$90:DE11` (`FUN_90de11`)
- `$91:CBB1` (`FUN_91cbb1`)

## Callees
- None
