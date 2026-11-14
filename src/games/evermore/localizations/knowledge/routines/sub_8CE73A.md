---
addr: 8CE73A
end: 8CE751
size: 24
kind: code
category: 🧠
name: sub_8CE73A
title: Script entity status update ($4000 flag set, $0076 clear, $FB87 mask)
confidence: confirmed
tags: [code, subroutine, script, entity]
evidence: ["disasm: `lda $0010,y : ora #$4000 : sta $0010,y : tdc : sta $0076,y : lda $0012,y : and #$FB87 : sta $0012,y : sec : rts` at $8C:E73A", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.47): 14/14 states (14/14 oracle, 222/222 fuzzed) match ROM, mutation caught"]
---

Entity state modification helper setting bit $4000 in entity record word `+$10`, clearing word field `+$76` to zero using TDC, masking attribute word `+$12` with `$FB87`, and returning via RTS with Carry set.

