---
addr: 90D31E
end: 90D341
size: 36
kind: code
category: 🧠
name: sub_90D31E
title: Green color channel linear interpolation and palette packing
confidence: confirmed
tags: [palette, graphics, hardware-multiplier, lerp, reconstructed-c, g1-pass]
evidence: ["disasm: stores masked A into DP $1D, calculates delta between green channels DP $1B and DP $1A, multiplies via hardware registers $4203/$4217, adds/subtracts delta to green channel, widens registers with REP #$30, packs into 15-bit BGR555 with DP $1C, and returns RTL", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.68): 44/44 states (44/44 oracle) match ROM, mutation caught"]
---

Palette processing routine for green channel interpolation and packing. Linearly interpolates between green channel values in DP `$1A` and DP `$1B` using SNES hardware multiplication registers (`$4203`/`$4217`), widens registers to 16-bit (`REP #$30`), shifts and packs the result into a 15-bit BGR555 color with DP `$1C`, and returns via RTL.
