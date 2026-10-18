---
addr: 8CD8FE
kind: code
category: 🧠
name: script_op_48_49_4a_4b
title: Script opcodes 0x48, 0x49, 0x4a, 0x4b
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands none, continues in the same turn (docs/game-research/script-vm/opcodes.md)"]
see: [docs/game-research/script-vm/opcodes.md]
---
No operands; $8C:C543, then fixed values to $0361-$036B.

Operands: none (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:AC8A`; `$8C:C543`
- Reads WRAM: `$7E:0B15`
- Writes WRAM: `$7E:0361`; `$7E:0363`; `$7E:0369`; `$7E:036B`; `$7E:036D`; `$7E:0371`; `$7E:0373`; `$7E:0375`; `$7E:0377`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$04`, `+$06`, `+$08`, `+$0A`, `+$0C`, `+$12`
- Opcode table entries: `$8C:E94D` (0x48), `$8C:E94F` (0x49), `$8C:E951` (0x4a), `$8C:E953` (0x4b)
