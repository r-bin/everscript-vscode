---
addr: 8CDCEC
kind: code
category: 🧠
name: script_op_3c_spawn
title: Script opcode 0x3c — spawn
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u16 u16 u8 u8, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 12 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Place an enemy or NPC: the first word is a byte offset into the ENEMY table at $8E:B55A (ENEMY value * 2), the second its state (bit 15: a spawner, $8F:DE98), then x and y in tiles (each * 8 to $46 / $48); $8F:A933, $8F:B094; the new entity goes to $0341.

Operands: `u16 u16 u8 u8` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8F:A933`; `$8F:B094`; `$8F:DE98`
- Writes WRAM: `$7E:0341`
- Reads ROM: `$8E:B55A` ENEMY id -> character record address (word table, 143 entries, right before the character table)
- Opcode table entry: `$8C:E935` (0x3c)
