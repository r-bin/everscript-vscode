---
addr: 8F9E30
end: 8F9E3A
size: 11
kind: code
category: 🧠
name: sub_8F9E30
title: Companion entity coordinate delta store and threshold update
confidence: confirmed
tags: [code, subroutine, companion, entity, movement]
evidence: ["disasm: `sta $0022,y : lda $12 : cmp $14 : bmi $8F9E3B : lda $14 : bit #$FFF0 : bne $8F9E43 : sta $0064,y : rts` at $8F:9E30", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.48): 31/31 states match ROM, mutation caught"]
---

Companion movement helper that records entity coordinate `$0022,Y`, compares direct page `$12` and `$14`, and updates threshold `$0064,Y` if `$14` is below the high mask `$FFF0`.
