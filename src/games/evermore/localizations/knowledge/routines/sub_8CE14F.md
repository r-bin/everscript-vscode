---
addr: 8CE14F
end: 8CE155
size: 7
kind: code
category: 🧠
name: sub_8CE14F
title: Script thread coordinate transformation dispatch
confidence: confirmed
tags: [code, subroutine, script, vm]
evidence: ["disasm: `tax : jsl $908124 : sec : rts` at $8C:E14F", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.48): 11/11 states match ROM, mutation caught"]
---

Script VM coordinate transformation bridge that moves accumulator to index register X, delegates to `$90:8124`, sets the carry flag, and returns via RTS.
