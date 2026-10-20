---
addr: 8CDA8D
kind: code
category: 🧠
name: stage_entity_absolute_position
title: Stage expression coordinates for an entity
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler evaluates an entity and two coordinate expressions into DP $46/$48, selects the shared coordinate path's skip mode, and returns without calling its position helper", "trace: the game ran 2 distinct instructions with this opcode (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/README.md, docs/game-research/script-vm/opcodes.md]
---
Evaluates an entity expression and two coordinate expressions, storing the latter in DP `$46`/`$48` without scaling or applying an entity-relative offset. It selects the shared continuation's skip mode, so `$8F:AA82` is not called and the opcode path makes no entity-coordinate write. The reason for staging these values is not yet established. Returns Carry Set.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8F:AA82`; `$8F:AAD3`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$2A`
- Opcode table entry: `$8C:E9A3` (0x73)
