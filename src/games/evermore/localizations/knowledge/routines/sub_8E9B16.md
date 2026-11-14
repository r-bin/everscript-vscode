---
addr: 8E9B16
end: 8E9B39
size: 36
kind: code
category: 🧠
name: sub_8E9B16
title: Audio table linear scan and counter clamp
confidence: confirmed
tags: [code, subroutine, audio, sound, wram]
evidence: ["disasm: `lda $7E0000,x : bne $8E9B24 : cpx #$2343 : beq $8E9B2D : inx : bra $8E9B16 ...` at $8E:9B16", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.48): 9/9 states (134/134 fuzzed) match ROM, mutation caught"]
---

Sound subsystem helper that scans entries in WRAM `$7E0000+X` until a non-zero value or index `$2343` is reached, increments counter `$0834`, and clamps `$0836` to zero if the decremented counter exceeds it.
