---
addr: 8CDF0D
kind: code
category: 🧠
name: script_op_70
title: Script opcode 0x70
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E E, continues in the same turn (docs/game-research/script-vm/opcodes.md)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Only the operands and the flow are traced so far; what the handler does with them is not.

Operands: `E E` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8C:DF33`
- Opcode table entry: `$8C:E99D` (0x70)
