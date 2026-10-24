---
addr: 8CDDB0
kind: code
category: 🧠
name: script_op_4e_bind_entity
title: Script opcode 0x4e — bind entity
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E, continues in the same turn (docs/scripts/opcodes.md)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x4E](soe://rom/assets/scripts/opcodes/4e.md). It decrements the old bound entity's `+$3E` reference count when nonzero, increments the evaluated entity's `+$3E` count when nonzero, stores the new entity address at the current slot's `+$0D`, and returns carry set. The host-side model is documented in `docs/disassembly/script-vm/opcode-4e-bind-entity.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$0D`, `+$3E`
- Opcode table entry: `$8C:E959` (0x4e)
