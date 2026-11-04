---
addr: $7E:0DFB
name: DIALOGUE_QUEUE
type: u24[9]
tags: [system]
confidence: verified
evidence: ["cdl", "disasm"]
---
Event cutscene script circular FIFO queue (9 slots, stride 3 bytes = 24-bit pointer pc_low, pc_high, bank; $7E:0DFB..$7E:0E15; indexed by head $7E:0B31 and tail $7E:0B2F in $8C:C521).
