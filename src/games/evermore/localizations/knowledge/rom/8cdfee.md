---
addr: 8CDFEE
kind: code
category: 🧠
name: script_op_42_teleport_tile
title: Script opcode 0x42: teleport an entity to a tile
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E u16, continues in the same turn (docs/scripts/opcodes.md)", "trace: the game ran 15 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)", "disasm: low byte * 8 -> $46, high byte * 8 -> $48, then the 0x43 tail at $8C:E01D (v0.320.0)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x42](soe://rom/assets/scripts/opcodes/42.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/42.md`, served at `soe://rom/assets/scripts/opcodes/42.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8F:C2D1`; `$8F:C2E4`
- Reads WRAM: `$7E:23DB` in Persistent RAM across rooms (names, story flags, markets, alchemy) (+$1DB)
- Writes WRAM: `$7E:23DB` in Persistent RAM across rooms (names, story flags, markets, alchemy) (+$1DB)
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$10`
- Opcode table entry: `$8C:E941` (0x42)
