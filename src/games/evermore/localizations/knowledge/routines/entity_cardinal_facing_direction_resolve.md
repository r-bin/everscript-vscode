---
addr: 8F9DBD
end: 8F9E2F
size: 115
kind: code
category: 🧠
name: entity_cardinal_facing_direction_resolve
title: Resolves cardinal and diagonal facing direction codes from signed X and Y displacement vectors
confidence: confirmed
tags: [engine, entity, ai, movement]
evidence: ["G1 differential testing against ROM and snes9x: 42/42 real states match 100%"]
---
Calculates the 8-way facing direction (0, 2, 4, 6, 8, 10, 12, 14) and proximity distance between target coordinates (X = target X, A = target Y) and entity coordinates at `+$1A,y` / `+$1C,y` in DB (`$7E`).

Stores facing direction to `+$22,y`, and if distance < 16, stores distance to `+$64,y`. Also writes delta-X to DP `$12` and delta-Y to DP `$14`.

## Calling Convention
- Input: `A` = target Y coordinate, `X` = target X coordinate, `Y` = entity struct offset in DB (`$7E`).
- Return: `RTS`.
- Side effects:
  - Writes DP `$12` = target_x - entity_x
  - Writes DP `$14` = target_y - entity_y
  - Writes `+$22,y` = resolved facing direction code (0..14 even)
  - If distance < 16, writes `+$64,y` = distance

## Facing Direction Codes
- `0`: Down
- `2`: Down-Right
- `4`: Right
- `6`: Up-Right
- `8`: Up
- `10`: Up-Left
- `12`: Left
- `14`: Down-Left
