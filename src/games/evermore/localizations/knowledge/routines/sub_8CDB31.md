---
addr: 8CDB31
end: 8CDB66
size: 54
kind: code
category: 🧠
name: sub_8CDB31
evidence: ["disasm: `bit #$0008 ... sec : rts` at $8C:DB31", "c: G1 passed 100% parity"]
---

Selective entity freeze helper that tests selection bitmask in A (bit 3: child entity, bit 0: boy at $4E89, bit 1: dog at $4F37) and invokes $8F:CD78 to freeze targeted entities while preserving accumulator across checks.
