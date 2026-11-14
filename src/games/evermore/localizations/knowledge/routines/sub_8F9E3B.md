---
addr: 8F9E3B
end: 8F9E43
size: 9
kind: code
category: 🧠
name: sub_8F9E3B
title: Companion threshold mask test and update
confidence: confirmed
tags: [code, subroutine, companion, entity, movement]
evidence: ["disasm: `bit #$FFF0 : bne $8F9E43 : sta $0064,y : rts` at $8F:9E3B", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.48): 36/36 states (576/576 fuzzed) match ROM, mutation caught"]
---

Companion movement helper alternate entry point that tests the accumulator against mask `$FFF0` and writes it to entity threshold `$0064,Y` before returning.
