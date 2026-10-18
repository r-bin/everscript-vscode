---
addr: 8CDDB0
kind: code
category: 🧠
name: script_op_4e_bind_entity
title: Script opcode 0x4e — bind entity
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E, continues in the same turn (docs/game-research/script-vm/opcodes.md)"]
see: [docs/game-research/script-vm/opcodes.md]
---
The slot's entity (slot + $0D) becomes the entity expression (reference counts at entity +$3E follow).

Operands: `E` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$0D`, `+$3E`
- Opcode table entry: `$8C:E959` (0x4e)
