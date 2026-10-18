---
addr: 8CD5AA
kind: code
category: 🧠
name: script_op_7e
title: Script opcode 0x7e
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E E E E, continues in the same turn (docs/game-research/script-vm/opcodes.md)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Only the operands and the flow are traced so far; what the handler does with them is not.

Operands: `E E E E` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Reads WRAM: `$7E:0AC6`; `$7E:0AC7`; `$7E:0AC8`
- Writes WRAM: `$7E:0AC6`; `$7E:0AC8`
- Hardware registers: `$4202`, `$4204`, `$4206`, `$4214`, `$4216`
- Opcode table entry: `$8C:E9B9` (0x7e)
