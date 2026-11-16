---
addr: 8F9DBD
end: 8F9E48
size: 140
kind: code
category: ⚔️
name: entity_cardinal_facing_direction_resolve
title: Calculates 8-way facing direction and proximity distance between target and entity
confidence: confirmed
tags: [entities, physics, math, ai, orientation]
evidence: ["disasm: subtracts target coordinates from entity coordinates +$1A,y / +$1C,y in DB, resolves 8-way facing direction (0, 2, 4, 6, 8, 10, 12, 14) into +$22,y, clamps proximity distance via BIT #$FFF0, and stores to +$64,y"]
see: [docs/disassembly/entities/ai-state-machines.md, routines/math_vector_2d_angle_and_distance_calc.md]
---
Calculates the 8-way facing direction (`0, 2, 4, 6, 8, 10, 12, 14`) and proximity distance between target coordinates (`X` = target X, `A` = target Y) and entity coordinates at `+$1A,y` / `+$1C,y` in data bank `DB`.

1. Computes Delta Y = `target Y - entity Y (+$1C,y)` into DP `$14`.
2. Computes Delta X = `target X - entity X (+$1A,y)` into DP `$12`.
3. Compares signs and relative magnitudes of Delta X and Delta Y to select the corresponding 8-way facing direction code:
   - `0`: North / Up
   - `2`: North-East
   - `4`: East / Right
   - `6`: South-East
   - `8`: South / Down
   - `10`: South-West
   - `12`: West / Left
   - `14`: North-West
4. Stores the resolved direction code into entity attribute `+$22,y`.
5. Evaluates maximum displacement `max(|dx|, |dy|)` against proximity threshold: if `BIT #$FFF0` indicates distance is less than 16 pixels, stores the distance into `+$64,y`.

## Callers
- `$8F:9C24` (`FUN_8f9c24`)

## Variables and memory
- `+$1A,y`: Entity current X coordinate
- `+$1C,y`: Entity current Y coordinate
- `+$22,y`: Entity resolved facing direction code (`0..14`, step 2)
- `+$64,y`: Proximity distance to target (when within 16 px)
- DP `$12`: Delta X displacement
- DP `$14`: Delta Y displacement
