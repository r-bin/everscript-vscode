---
addr: 8CDDFF
kind: code
category: 🧠
name: script_op_5d_set_object_state_by_flag
title: Script opcode 0x5d — set object state by flag
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E u16, continues in the same turn (docs/scripts/opcodes.md)", "trace: the game ran 50 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x5D](soe://rom/assets/scripts/opcodes/5d.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/5d.md`, served at `soe://rom/assets/scripts/opcodes/5d.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$90:A36D`
- Reads ROM: `$80:A87F`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$00`
- Opcode table entry: `$8C:E977` (0x5d)
