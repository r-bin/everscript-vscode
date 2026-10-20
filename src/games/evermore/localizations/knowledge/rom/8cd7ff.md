---
addr: 8CD7FF
kind: code
category: 🧠
name: script_op_11_15_write_temp_byte
title: Script opcodes 0x11, 0x15 — write temp byte
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u16 E, continues in the same turn (docs/scripts/opcodes.md)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcodes [0x11](soe://rom/assets/scripts/opcodes/11.md), [0x15](soe://rom/assets/scripts/opcodes/15.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/11.md`, served at `soe://rom/assets/scripts/opcodes/11.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$00`
- Opcode table entries: `$8C:E8DF` (0x11), `$8C:E8E7` (0x15)
