---
addr: 80ac27
end: 80AC6E
size: 72
kind: code
name: math_sqrt_binary_search
title: 16-Bit Integer Square Root via Binary Search
confidence: confirmed
tags: [math, sqrt, binary_search, table]
evidence: ["disasm: BIT #$FF00 / BNE + / TAX / LDA.L $80A927,X / RTL / CMP #$FE01 / BCC + / LDA #$00FF / RTL / LDX #$AB25 / binary search loop (out/recomp/asar/rom.bin:0x00AC27)"]
see: [src/games/evermore/localizations/knowledge/rom/80aa27.md, src/games/evermore/localizations/knowledge/rom/80ac6f.md]
---
16-bit integer square root calculation ($\lfloor \sqrt{x} \rfloor$) via binary search:
- If input $x < 256$: performs direct table lookup in precomputed square root table (`LDA.L $80A927,X`) and returns immediately.
- If input $x \ge 65025$ (`0xFE01` = $255^2$): clamps result to maximum 8-bit magnitude `255` (`$00FF`).
- Otherwise: executes binary search over the 256-entry table of integer squares (`$80:AA27`) using bisection pivot step `$12` to find $\lfloor \sqrt{x} \rfloor$ in $\le 8$ iterations.
- Returns integer square root in Accumulator A.
