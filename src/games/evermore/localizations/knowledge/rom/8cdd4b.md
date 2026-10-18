---
addr: 8CDD4B
kind: code
category: 🧠
name: script_op_3d
title: Script opcode 0x3d
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E u16, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 20 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Entity expression; the word to entity +$66, $40 to entity +$68.

Operands: `E u16` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.
