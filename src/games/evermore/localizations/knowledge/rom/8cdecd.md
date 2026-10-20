---
addr: 8CDECD
kind: code
category: 🧠
name: poll_field_state_2_alternate
title: Poll alternate field state mode 2
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler sets X to 2 and calls $8C:C67C; that helper polls $0B79 using a different set of wait conditions from $8C:C627"]
see: [docs/game-research/script-vm/opcodes.md]
---
With no operands, calls `$8C:C67C` with X set to 2. This helper polls `$0B79` using a distinct condition set and services field ticks while waiting. The handler returns Carry Set; the game-state meaning of the bit combinations remains unresolved.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:C67C`
- Opcode table entry: `$8C:E991` (0x6a)
