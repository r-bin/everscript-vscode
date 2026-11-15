---
addr: 8FA471
end: 8FA475
size: 5
kind: code
category: 🧠
name: sub_8FA471
evidence: ["disasm: `inc a : sta $67 : bra $8FA47F` at $8F:A471", "c: G1 passed 100% parity"]
---

Metatile collision probe entry point that increments tile Y in accumulator A, stores it to `$67`, and branches into `$8F:A47F`.
