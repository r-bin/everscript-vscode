---
addr: 8CDA69
end: 8CDA87
size: 31
kind: code
category: 🧠
name: sub_8CDA69
evidence: ["disasm: `jsl $8CEC8E : lda [$82] : inc $82 ... sec : rts` at $8C:DA69", "c: G1 passed 100% parity"]
---

Script opcode helper that resolves target coordinates from script stream arguments or target entity, setting script jitter flag $12 to 0 before dispatching into $8C:DAA6.
