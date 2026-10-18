---
addr: 8CDE8F
kind: code
category: 🧠
name: script_op_5a
title: Script opcode 0x5a
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands none, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 1 distinct instruction with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Only the operands and the flow are traced so far; what the handler does with them is not.

Operands: none (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:C5E2`
- Opcode table entry: `$8C:E971` (0x5a)
