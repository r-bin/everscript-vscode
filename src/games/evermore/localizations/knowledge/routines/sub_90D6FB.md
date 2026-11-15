---
addr: 90D6FB
end: 90D72B
size: 49
kind: code
category: 🧠
name: sub_90D6FB
evidence: ["disasm: `phy : tyx : ldy $0ECE,x : lda $0ED5,x ... jsl $90D749 : clc : rts` at $90:D6FB", "c: G1 passed 100% parity"]
---

Projectile cluster particle physics decay and bounce tick loop that decrements decay timers at $0ED5, integrates position offsets at $0ED0, resets particle velocity on ground bounce, and delegates rendering to $90:D749.
