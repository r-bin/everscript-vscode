---
addr: 8CDEF5
kind: code
category: 🧠
name: script_op_75
title: Script opcode 0x75
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 26 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Only the operands and the flow are traced so far; what the handler does with them is not.

Operands: `E` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.
