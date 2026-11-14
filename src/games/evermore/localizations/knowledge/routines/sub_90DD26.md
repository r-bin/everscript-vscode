---
addr: 90DD26
end: 90DD2C
size: 7
kind: code
category: 🧠
name: sub_90DD26
title: Projectile duration slot timer initialize (20 frames)
confidence: confirmed
tags: [code, subroutine, projectile, combat]
evidence: ["disasm: `lda #$0014 : sta $0026,y : rtl` at $90:DD26", "called by projectile slot setup at $90:DCE4", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.46): 46/46 states (46/46 oracle, 728/728 fuzzed) match ROM, mutation caught"]
---

Projectile lifecycle subroutine writing duration count `0x0014` (20 frames) into projectile slot field `+$26` at index Y and returning via RTL.

