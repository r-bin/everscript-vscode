---
addr: 8CDE2E
kind: code
category: 🧠
name: script_op_5e_set_object_state_unless_flag
title: Script opcode 0x5e — set object state unless flag
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E u16, continues in the same turn (docs/scripts/opcodes.md)", "disasm: $8C:DE67 after this handler is a second copy of the 0x5C handler that no table entry points to"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x5E](soe://rom/assets/scripts/opcodes/5e.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/5e.md`, served at `soe://rom/assets/scripts/opcodes/5e.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$90:A36D`
- Reads ROM: `$80:A87F`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$00`
- Opcode table entry: `$8C:E979` (0x5e)
