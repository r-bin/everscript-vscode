---
addr: 8FA463
end: 8FA467
size: 5
kind: code
category: 🧠
name: sub_8FA463
evidence: ["disasm: `dec a : sta $67 : bra $8FA47F` at $8F:A463", "c: G1 passed 100% parity"]
---

Metatile collision probe entry point that decrements tile Y in accumulator A, stores it to direct page $67, and branches into the shared map tile collision probe at $8F:A47F.
