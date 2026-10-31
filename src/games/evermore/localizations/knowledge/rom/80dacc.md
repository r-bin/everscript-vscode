---
addr: 80DACC
kind: code
category: 🗺️
name: calc_rotated_velocity_vector
title: 2D rotated camera translation velocity vector calculator ($80:DACC)
confidence: confirmed
evidence: ["disasm: multiplies high byte of camera velocity $14B6 by cosine $14A4 into $14A8 (dx) and by sine $14A6 into $14AA (dy); clears $14A8 and $14AA if $14B6 == 0; caller: $80:DA9A"]
see: [rom/80daa6.md]
tags: [camera, math, vectors, rotation]
---
Projects 1D camera pan velocity `$14B6` into a 2D rotated translation vector. Multiplies velocity magnitude by cosine component `$14A4` to produce horizontal displacement `$14A8` (dx), and by sine component `$14A6` to produce vertical displacement `$14AA` (dy).
