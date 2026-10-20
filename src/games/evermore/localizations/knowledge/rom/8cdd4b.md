---
addr: 8CDD4B
kind: code
category: 🧠
name: script_op_3d_attach_talk_script
title: Script opcode 0x3D: give an entity a talk script
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E u16, continues in the same turn (docs/scripts/opcodes.md)", "trace: the game ran 20 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)", "disasm: $8F:AC0E tests +$68 bit $0040 and the Boy's distance (< $21 px) before running +$66 (v0.320.0)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x3D](soe://rom/assets/scripts/opcodes/3d.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/3d.md`, served at `soe://rom/assets/scripts/opcodes/3d.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$66`, `+$68`
- Opcode table entry: `$8C:E937` (0x3d)
