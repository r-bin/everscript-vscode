---
addr: 8CE2AA
kind: code
category: 🧠
name: reset_catalog_parameter_state
title: Reset catalog parameter state
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: no-operand handler writes $FFFF to $0B95, clears $0E6C, and returns Carry Set"]
see: [docs/game-research/script-vm/README.md, docs/game-research/script-vm/opcodes.md]
---
With no operands, initializes `$0B95` to `$FFFF` and clears `$0E6C`, then returns Carry Set. These state fields are also consumed by opcodes `0x89` and `0x8A`, including the shop-catalog dispatch path; the broader subsystem role is not fully named here.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Writes WRAM: `$7E:0B95`; `$7E:0E6C`
- Opcode table entry: `$8C:E9CD` (0x88)
