---
addr: 8CDFEE
kind: code
category: 🧠
name: script_op_42_teleport_tile
title: Script opcode 0x42: teleport an entity to a tile
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E u16, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 15 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)", "disasm: low byte * 8 -> $46, high byte * 8 -> $48, then the 0x43 tail at $8C:E01D (v0.320.0)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Entity expression and a word: low byte = x, high byte = y, in tiles (* 8 into DP `$46`/`$48`), then the tail of opcode `0x43`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8F:C2D1`; `$8F:C2E4`
- Reads WRAM: `$7E:23DB` in Persistent RAM across rooms (names, story flags, markets, alchemy) (+$1DB)
- Writes WRAM: `$7E:23DB` in Persistent RAM across rooms (names, story flags, markets, alchemy) (+$1DB)
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$10`
- Opcode table entry: `$8C:E941` (0x42)
