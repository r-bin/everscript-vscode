---
addr: 80ac6f
end: 80ACF4
size: 134
kind: code
name: math_sqrt_restoring_subtraction
title: Fast 16-Bit Integer Square Root via Successive Power-of-Two Subtraction
confidence: confirmed
tags: [math, sqrt, algorithm, fast]
evidence: ["disasm: BIT #$F000 / BIT #$C000 / BIT #$8000 / branch pyramid subtracting power-of-two roots / SBC loop (out/recomp/asar/rom.bin:0x00AC6F)"]
see: [src/games/evermore/localizations/knowledge/routines/tbl_integer_squares.md, src/games/evermore/localizations/knowledge/routines/math_sqrt_binary_search.md]
---
Fast restoring subtraction 16-bit integer square root algorithm:
- Directly tests higher-order bit ranges (`$F000`, `$C000`, `$8000`, `$2000`, `$0C00`, `$0800`, `$0200`) to seed the closest initial square root estimate.
- Applies successive approximation subtraction steps to converge on the exact floor integer square root $\lfloor \sqrt{x} \rfloor$.
- Returns calculated square root in Accumulator A.
