---
addr: 8CD3DA
end: 8CD3FC
size: 35
kind: code
category: 🧠
name: sub_8CD3DA
evidence: ["disasm: `jsl $8CCF18 : ldy $7E : tya : sta $000B,x ... clc : rts` at $8C:D3DA", "c: G1 passed 100% parity"]
---

Script thread allocation and attachment helper that allocates a script slot via $8C:CF18, attaches it as child to current entity $7E, increments reference count on context if non-zero, pushes new thread ID onto stack at $2F28, and clears carry.
