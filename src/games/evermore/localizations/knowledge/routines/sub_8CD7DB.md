---
addr: 8CD7DB
end: 8CD7E0
size: 6
kind: code
category: 🧠
name: sub_8CD7DB
evidence: ["disasm: `pha : jsl $8CEA43 : plx : sta $0000,x : sec : rts` at $8C:D7DB", "c: G1 passed 100% parity"]
---

Script expression write execution helper that preserves target RAM address on stack, evaluates following script expression via $8C:EA43, stores expression result into target address at $0000,x, sets carry, and returns.
