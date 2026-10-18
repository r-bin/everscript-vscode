---
addr: 8CD7CC
kind: code
category: 🧠
name: script_op_19_1d_write_temp_word
title: Script opcodes 0x19, 0x1d — write temp word
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u16 E, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 74 distinct instructions with these opcodes; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Word at $2834 + offset = expression.

Operands: `u16 E` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.
