---
addr: 8CDD01
end: 8CDD18
size: 24
kind: code
category: 🧠
name: sub_8CDD01
evidence: ["disasm: `lda [$82] : inc $82 ... jsl $8FA933 ... sec : rts` at $8C:DD01", "c: G1 passed 100% parity"]
---

Opcode spawning helper that decodes pixel coordinates from script bytecode, calculates distance vector via $8F:A933, and if in range initializes entity slot via $8F:B094.
