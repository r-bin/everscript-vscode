---
addr: 8CE6EA
kind: code
category: 🧠
name: script_op_a9
title: Script opcode 0xa9
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E E, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 32 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Entity expression, an expression that picks one of the routines at $8C:E6F8 (none reads operands).

Operands: `E E` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.
