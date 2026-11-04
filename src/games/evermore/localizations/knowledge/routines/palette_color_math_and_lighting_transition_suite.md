---
addr: 90D0A4
end: 90D2A5
size: 514
kind: code
category: 🧠
name: palette_color_math_and_lighting_transition_suite
title: CGRAM palette color math, subtractive blending, and cross-fade lighting routines
confidence: confirmed
tags: [palette, cgram, color-math, graphics, lighting]
evidence: ["disasm: 514 bytes at $90:D0A4..$90:D2A5 containing palette subtractive color blending, additive tinting, and 15-bit BGR555 shade cross-fading; precedes graphics_color_555_linear_blend_lerp ($90:D2A6)"]
see: [rom/90cff0.md, rom/90d020.md, rom/90d2a6.md]
---
Suite of PPU CGRAM palette color math and cross-fade transition routines:
- Performs bitwise 15-bit BGR555 channel decomposition (5 bits Red, 5 bits Green, 5 bits Blue).
- Calculates subtractive color blending, additive color tints, and smooth shading transitions across active palette staging buffers.
- Prepares color values for hardware PPU multiplication and interpolation in `graphics_color_555_linear_blend_lerp` (`$90:D2A6`).

