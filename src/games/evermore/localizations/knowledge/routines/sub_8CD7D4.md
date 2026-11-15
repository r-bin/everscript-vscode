---
addr: 8CD7D4
end: 8CD7DA
size: 7
kind: code
category: 🧠
name: sub_8CD7D4
evidence: ["disasm: `clc : adc [$82] : inc $82 : inc $82 : pha ... sec : rts` at $8C:D7D4", "c: G1 passed 100% parity"]
---

Script bytecode variable write offset adder that consumes a 16-bit inline offset from script stream $82, adds base address in A to determine target memory address, and falls into $8C:D7DB.
