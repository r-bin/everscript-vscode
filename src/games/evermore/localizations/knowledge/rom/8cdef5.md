---
addr: 8CDEF5
kind: code
category: 🧠
name: script_op_75_face_8
title: Script opcode 0x75 — face 8
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 26 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Entity faces direction 8 (+$22 = 8).

Operands: `E` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$22`
- Opcode table entry: `$8C:E9A7` (0x75)
