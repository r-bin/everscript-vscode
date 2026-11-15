---
addr: 8CDADB
end: 8CDB10
size: 54
kind: code
category: 🧠
name: sub_8CDADB
evidence: ["disasm: `sta $02 : bit #$0008 ... sec : rts` at $8C:DADB", "c: G1 passed 100% parity"]
---

Selective entity unfreeze helper that inspects entity selection bitmask in A (bit 3: child entity, bit 0: boy at $4E89, bit 1: dog at $4F37) and calls $8F:CD4D to clear freeze state.
