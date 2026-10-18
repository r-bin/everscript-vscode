---
addr: 8CE6EA
kind: code
category: 🧠
name: script_op_a9
title: Script opcode 0xa9
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E E, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 32 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Entity expression, an expression that picks one of the routines at $8C:E6F8 (none reads operands).

Operands: `E E` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Dispatches through: `$8C:E6F8`
- Opcode table entry: `$8C:EA0F` (0xa9)
