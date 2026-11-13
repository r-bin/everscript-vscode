---
addr: 90D34C
end: 90D407
size: 188
kind: code
category: 🎨
name: memory_block_copy_indirect_words
title: 15-bit BGR555 palette color crossfader and direct word block transfer
confidence: verified
tags: [palette, crossfade, dma, hardware-multiplier]
evidence: ["G1 differential testing: 28/28 reference states, 285/285 fuzzed states match ROM, mutation caught"]
---
Palette color crossfader and block transfer primitive.

Interpolates between two 15-bit BGR555 color palettes using the SNES hardware multiplier (`$4202`/`$4203` -> `$4216`), or performs direct block copies at the boundary ratios (0% and 100%).

## Parameters & Variables
- Direct Page `$14`: Word count (number of 16-bit BGR555 colors to transfer/blend). Returns immediately if 0.
- Direct Page `$12`: Blend ratio (0..0x100).
- Direct Page `$26`..`$28`: 24-bit far pointer to source palette A.
- Direct Page `$2A`..`$2C`: 24-bit far pointer to source palette B.
- Direct Page `$2E`..`$30`: 24-bit far pointer to destination palette buffer.

## Behavior
- If `ratio == 0`: Copies `$14` words directly from `[$26]` to `[$2E]`.
- If `ratio >= 0x100`: Copies `$14` words directly from `[$2A]` to `[$2E]`.
- If `0 < ratio < 0x100`: Crossfades each 15-bit BGR555 color component:
  - `Red:   ((256 - ratio) * Red_A   + ratio * Red_B)   >> 8`
  - `Green: ((256 - ratio) * Green_A + ratio * Green_B) >> 8`
  - `Blue:  ((256 - ratio) * Blue_A  + ratio * Blue_B)  >> 8`

## Callers
- `$8C:E4B1` (`FUN_8ce4b1`)
- `$8E:E124` (`FUN_8ee124`)
- `$8F:9535` (`FUN_8f9535`)
- `$90:D481` (`FUN_90d481`)

## Callees
- None
