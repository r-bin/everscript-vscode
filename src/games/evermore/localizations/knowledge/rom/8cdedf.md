---
addr: 8CDEDF
kind: code
category: 🧠
name: script_op_74_face_0
title: Script opcode 0x74 — face 0
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E, continues in the same turn (docs/scripts/opcodes.md)", "trace: the game ran 18 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x74](soe://rom/assets/scripts/opcodes/74.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/74.md`, served at `soe://rom/assets/scripts/opcodes/74.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$22`
- Opcode table entry: `$8C:E9A5` (0x74)
