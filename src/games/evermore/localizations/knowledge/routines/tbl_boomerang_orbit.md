---
addr: 90DF44
end: 90DFA8
size: 101
kind: table
category: 🧠
name: tbl_boomerang_orbit
title: Boomerang and curved projectile elliptical orbit displacement table
confidence: confirmed
tags: [projectiles, weapons, combat, math]
evidence: ["disasm: func_90DF44 / projectile routine reads coordinate pairs at $90:DF44, indexed by orbit step 0..255", "math: coordinates correspond to X = cos * 8, Y = sin * 4 in 1/16th pixel precision"]
see: [src/games/evermore/localizations/knowledge/routines/trig_sine_table.md]
---
Elliptical orbital trajectory table for curved projectiles (such as the Boomerang).
Holds 256 word pairs (`[int16_t x, int16_t y]`, 1,024 bytes total) representing sub-pixel offsets from projectile origin.
A complete turn spans 256 game frames. Used by `maps/projectiles.ts` and drawn in the Data tab (Tables › Boomerang orbit).

