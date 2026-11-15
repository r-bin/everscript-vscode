---
addr: 8FA47F
end: 8FA4BB
size: 61
kind: code
category: 🧠
name: sub_8FA47F
evidence: ["disasm: `sta $4202 : lda $08ee : sta $4203 : rep #$31 : ... : rtl` at $8F:A47F", "c: G1 passed 100% parity"]
---

Computes map metatile collision and elevation flags at tile position `($66, A)`: multiplies tile row index by map width stride (`$08EE`), indexes the room terrain attribute matrix via pointer `$06`, and tests elevation passability flags in `$68`.
