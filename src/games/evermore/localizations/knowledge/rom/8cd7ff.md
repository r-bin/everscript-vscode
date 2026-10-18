---
addr: 8CD7FF
kind: code
category: 🧠
name: script_op_11_15_write_temp_byte
title: Script opcodes 0x11, 0x15 — write temp byte
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u16 E, continues in the same turn (docs/game-research/script-vm/opcodes.md)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Byte at $2834 + offset = expression.

Operands: `u16 E` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$00`
- Opcode table entries: `$8C:E8DF` (0x11), `$8C:E8E7` (0x15)
