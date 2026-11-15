---
addr: 9087DF
end: 90880F
size: 49
kind: code
category: 🧠
name: sub_9087DF
evidence: ["disasm: `clc : adc $001A,y : sta $46 ... jsl $8FB5E6 : sep #$20 : ldy $4C : rts` at $90:87DF", "c: G1 passed 100% parity"]
---

Action animation hitbox strike coordinate resolver and collision probe that adds horizontal offset in A to entity X coordinate, reads frame dimensions from animation stream $5D, performs entity collision test via $8F:B5E6, and restores entity pointer to Y.
