---
addr: 8CDC9A
kind: code
category: 🧠
name: script_op_a2_spawn_at
title: Script opcode 0xa2 — spawn at
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u16 u16 E E, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 3 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
As 0x3C with x and y as expressions (pixels).

Operands: `u16 u16 E E` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8F:A933`; `$8F:B094`; `$8F:DE98`
- Writes WRAM: `$7E:0341`
- Reads ROM: `$8E:B55A` ENEMY id -> character record address (word table, 143 entries, right before the character table)
- Opcode table entry: `$8C:EA01` (0xa2)
