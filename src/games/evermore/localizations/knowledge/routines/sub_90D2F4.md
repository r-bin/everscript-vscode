---
addr: 90D2F4
end: 90D31D
size: 42
kind: code
category: 🧠
name: sub_90D2F4
title: Blue and green color channel linear interpolation and palette packing
confidence: confirmed
tags: [palette, graphics, hardware-multiplier, lerp, reconstructed-c, g1-pass]
evidence: ["disasm: stores red channel in A into DP $1C, calculates delta between blue channels DP $19 and DP $17, multiplies via hardware registers $4203/$4217, adds/subtracts delta to blue channel, then performs green channel interpolation and packing through $90:D31E, returning via RTL", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.69): 44/44 states (44/44 oracle) match ROM, mutation caught"]
---

Palette processing routine for blue and green channel interpolation and packing. Stores the red channel value in A into DP `$1C`, linearly interpolates between blue channel values in DP `$17` and DP `$19` using SNES hardware multiplication registers (`$4203`/`$4217`), then continues through green channel interpolation and packing into 15-bit BGR555 color, returning via RTL.
