---
addr: 8CDCC3
kind: code
category: 🧠
name: script_op_c2_spawn_spawner
title: Script opcode 0xc2 — spawn spawner
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u8 u8 u8, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 30 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
As 0xBA with state $8000: places a spawner.

Operands: `u8 u8 u8` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8F:A933`; `$8F:B094`; `$8F:DE98`
- Writes WRAM: `$7E:0341`
- Reads ROM: `$8E:B55A` ENEMY id -> character record address (word table, 143 entries, right before the character table)
- Opcode table entry: `$8C:EA41` (0xc2)
