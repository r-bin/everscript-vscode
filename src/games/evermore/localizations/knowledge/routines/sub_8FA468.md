---
addr: 8FA468
end: 8FA46E
size: 7
kind: code
category: 🧠
name: sub_8FA468
evidence: ["disasm: `dec $66 : dec a : sta $67 : bra $8FA47F` at $8F:A468", "c: G1 passed 100% parity"]
---

Metatile collision probe entry point that decrements tile X coordinate `$66`, decrements tile Y in accumulator A, stores it to `$67`, and branches into `$8F:A47F`.
