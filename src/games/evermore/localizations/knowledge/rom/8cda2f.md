---
addr: 8CDA2F
kind: code
category: 🧠
name: move_entity_by_tile_delta
title: Move an entity by expression offsets
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler evaluates the entity and two offsets, scales each offset by 16, adds them to entity fields +$1A/+$1C, then enters the shared position helper", "trace: the game ran 1 distinct instruction with this opcode (tests/script-vm/goldens.json)"]
see: [docs/scripts/vm.md, docs/scripts/opcodes.md]
---
Handler of script opcode [0x6D](soe://rom/assets/scripts/opcodes/6d.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/6d.md`, served at `soe://rom/assets/scripts/opcodes/6d.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8F:AA82`; `$8F:AAD3`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$1A`, `+$1C`, `+$2A`
- Opcode table entry: `$8C:E997` (0x6d)
