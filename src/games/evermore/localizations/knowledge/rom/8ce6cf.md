---
addr: 8CE6CF
kind: code
category: 🧠
name: script_op_9a
title: Script opcode 0x9a
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 14 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Only the operands and the flow are traced so far; what the handler does with them is not.

Operands: `E` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8C:9DAF`
- Reads ROM: `$8C:E6E6`
- Opcode table entry: `$8C:E9F1` (0x9a)
