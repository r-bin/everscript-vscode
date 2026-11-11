---
addr: 90D2A6
end: 90D34B
size: 166
kind: code
category: 🧠
name: graphics_color_555_linear_blend_lerp
title: Linearly interpolates two 15-bit BGR555 colors using hardware multiplier ($90:D2A6)
confidence: verified
tags: [palettes, graphics, math]
evidence: ["disasm: whole routine read ($90:D2A6..$90:D34B); uses DP $12 blend weight (0 returns $16, nonzero high byte with 0 low byte returns $18), separates 5-bit R/G/B of $16 and $18, multiplies delta via $4202/$4203/$4217 and returns blended BGR555 in A", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.39): 46/46 states and 736/736 fuzzed match ROM, mutation caught"]
---

Linearly interpolates between two 15-bit BGR555 colors in `DP $16` and `DP $18` according to blend factor `DP $12` (`$12 & $FF == 0` returns `$16` if `$12 == 0`, else `$18`), computing per-channel fixed-point steps via SNES hardware multiplier `$4202`/`$4203`/`$4217` and returning the blended 15-bit color in `A`.
