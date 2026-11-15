---
addr: 8FAB0B
end: 8FAB0D
size: 3
kind: code
category: 🧠
name: sub_8FAB0B
evidence: ["disasm: `lda #$00 : bra $8FAB20` at $8F:AB0B", "c: G1 passed 100% parity"]
---

Companion breadcrumb distance check entry point that clears accumulator A to 0 and branches into the breadcrumb traversal loop at `$8F:AB20`.
