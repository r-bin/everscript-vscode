---
addr: 8CDED6
kind: code
category: 🧠
name: poll_field_state_2
title: Poll field state mode 2
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler sets X to 2 and calls $8C:C627; that helper polls $0B79 and services field ticks on selected wait conditions"]
see: [docs/game-research/script-vm/opcodes.md]
---
With no operands, calls `$8C:C627` with X set to 2. The helper polls selected `$0B79` bits and advances field ticks while waiting on its internal conditions. This handler returns Carry Set and does not yield the script thread itself.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:C627`
- Opcode table entry: `$8C:E98F` (0x69)
