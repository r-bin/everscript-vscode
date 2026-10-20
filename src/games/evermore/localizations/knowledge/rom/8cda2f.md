---
addr: 8CDA2F
kind: code
category: 🧠
name: move_entity_by_tile_delta
title: Move an entity by expression offsets
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler evaluates the entity and two offsets, scales each offset by 16, adds them to entity fields +$1A/+$1C, then enters the shared position helper", "trace: the game ran 1 distinct instruction with this opcode (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/README.md, docs/game-research/script-vm/opcodes.md]
---
Evaluates an entity followed by X and Y expressions. Each offset is shifted left four bits and added to the entity's current coordinate fields `+$1A` and `+$1C`; the resulting pixel destination goes through the same tile/elevation and movement helper as `0x6C`. Returns Carry Set.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8F:AA82`; `$8F:AAD3`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$1A`, `+$1C`, `+$2A`
- Opcode table entry: `$8C:E997` (0x6d)
