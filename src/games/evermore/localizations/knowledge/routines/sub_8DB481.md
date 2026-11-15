---
addr: 8DB481
end: 8DB491
size: 17
kind: code
category: 🧠
name: sub_8DB481
title: Math stream bit shift and accumulator addition loop
confidence: confirmed
tags: [code, subroutine, math, arithmetic]
evidence: ["disasm: `dey : beq $8DB48F : inx : rep #$20 : asl a : sep #$20 : adc $0000,x : bra $8DB481 : rep #$20 : rtl` at $8D:B481", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.48): 33/33 states (151/151 fuzzed) match ROM, mutation caught"]
---

Arithmetic polynomial loop that iterates up to Y times, shifting accumulator A left by 1 bit in 16-bit mode, advancing index X, and adding the indexed memory byte with Carry.

