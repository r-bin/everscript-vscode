---
addr: 8CDEB4
kind: code
category: 🧠
name: poll_field_state_1
title: Poll field state mode 1
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler sets X to 1 and calls $8C:C627; that helper polls $0B79 and services field ticks on selected wait conditions"]
see: [docs/game-research/script-vm/opcodes.md]
---
With no operands, calls `$8C:C627` with X set to 1. The helper polls selected `$0B79` bits and advances a field tick while waiting on its internal conditions. This handler returns Carry Set; it does not itself yield the script thread.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:C627`
- Opcode table entry: `$8C:E987` (0x65)
