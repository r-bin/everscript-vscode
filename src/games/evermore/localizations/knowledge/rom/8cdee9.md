---
addr: 8CDEE9
kind: code
category: 🧠
name: script_op_77_face_4
title: Script opcode 0x77 — face 4
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E, continues in the same turn (docs/scripts/opcodes.md)", "trace: the game ran 26 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x77](soe://rom/assets/scripts/opcodes/77.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/77.md`, served at `soe://rom/assets/scripts/opcodes/77.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$22`
- Opcode table entry: `$8C:E9AB` (0x77)
