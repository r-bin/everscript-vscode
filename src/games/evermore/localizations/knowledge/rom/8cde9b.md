---
addr: 8CDE9B
kind: code
category: 🧠
name: set_0b73_and_poll_state
title: Set $0B73 and poll field state
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler evaluates E into $0B73, sets X to 1 and calls $8C:C627; that helper polls $0B79 and services field ticks on selected wait conditions"]
see: [docs/game-research/script-vm/opcodes.md]
---
Evaluates its `E` operand into `$0B73`, then calls `$8C:C627` with X set to 1. That helper checks selected bits in `$0B79` and calls the field-tick routine while its wait conditions hold. The opcode itself returns Carry Set after the helper returns; the exact meaning of `$0B73` is not established here.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8C:C627`
- Writes WRAM: `$7E:0B73`
- Opcode table entry: `$8C:E985` (0x64)
