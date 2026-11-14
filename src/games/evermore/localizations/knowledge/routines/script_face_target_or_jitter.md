---
addr: 8CDAA6
end: 8CDAC4
size: 31
kind: code
category: 🧠
name: script_face_target_or_jitter
title: Script entity face target or jitter angle calculation
confidence: confirmed
tags: [code, subroutine, script, vm, entity, direction]
evidence: ["disasm: `ldy $4c : cpy #$4e89 : bcs $8CDAB2 : lda $002A,y : beq $8CDABD ...` at $8C:DAA6", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.48): 32/32 states (112/112 fuzzed) match ROM, mutation caught"]
---

Calculates the facing angle towards a target entity or evaluates a jitter offset angle via `$8F:AA82`, returning with Carry set on completion.
