---
addr: 8CDCEC
kind: code
category: 🧠
name: script_op_3c
title: Script opcode 0x3c
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u16 u16 u8 u8, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 12 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
A word indexing the table at $8E:B55A, a word, two bytes times 8.

Operands: `u16 u16 u8 u8` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.
