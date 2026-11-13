---
addr: 8CDF01
size: 12
end: 8CDF0C
kind: code
category: 🧠
name: script_op_76_face_12
title: Script opcode 0x76 — face 12
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E, continues in the same turn (docs/scripts/opcodes.md)", "trace: the game ran 12 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.40): 2/2 states (2/2 oracle) match ROM, mutation caught"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x76](soe://rom/assets/scripts/opcodes/76.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/76.md`, served at `soe://rom/assets/scripts/opcodes/76.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$22`
- Opcode table entry: `$8C:E9A9` (0x76)
