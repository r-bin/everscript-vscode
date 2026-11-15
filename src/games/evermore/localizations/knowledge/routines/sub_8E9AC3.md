---
addr: 8E9AC3
end: 8E9B15
size: 83
kind: code
category: 🧠
name: sub_8E9AC3
evidence: ["disasm: `lda $7e0000,x : bne $8E9AD3 : cpx #$233F : beq $8E9AD8 : inx : bra $8E9AC3` at $8E:9AC3", "c: G1 passed 100% parity"]
---

Audio queue initialization and channel assignment routine that scans audio table in WRAM `$7E0000+X`, assigns queue entry `$0020` or `$0026` at `$0814+Y`, updates queue length `$0810`, and resets voice control registers `$0834-$0840`.
