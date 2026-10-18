---
addr: 8CDC9A
kind: code
category: 🧠
name: script_op_a2
title: Script opcode 0xa2
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u16 u16 E E, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 3 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Only the operands and the flow are traced so far; what the handler does with them is not.

Operands: `u16 u16 E E` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.
