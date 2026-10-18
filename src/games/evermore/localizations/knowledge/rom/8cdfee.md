---
addr: 8CDFEE
kind: code
category: 🧠
name: script_op_42
title: Script opcode 0x42
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E u16, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 15 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Entity expression and a word whose two bytes times 8 go to $46 / $48.

Operands: `E u16` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.
