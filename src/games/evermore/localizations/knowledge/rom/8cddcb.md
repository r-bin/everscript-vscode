---
addr: 8CDDCB
kind: code
category: 🧠
name: script_op_5c_set_object_state
title: Script opcode 0x5c — set object state
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E E, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 62 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Map object (first expression) goes to the state of the second, through $90:A36D: clamped to the object's highest state, kept at $107E + object, animated when it differs from the current one ($10CE + object).

Operands: `E E` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$90:A36D`
- Opcode table entry: `$8C:E975` (0x5c)
