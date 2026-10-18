---
addr: 8CDACA
kind: code
category: 🧠
name: script_op_bf
title: Script opcode 0xbf
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands none, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 4 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Only the operands and the flow are traced so far; what the handler does with them is not.

Operands: none (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.
