---
addr: 8CDFCF
kind: code
category: 🧠
name: script_op_62
title: Script opcode 0x62
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u8 u16 u16, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 4 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Only the operands and the flow are traced so far; what the handler does with them is not.

Operands: `u8 u16 u16` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$90:A2A2`
- Opcode table entry: `$8C:E981` (0x62)
