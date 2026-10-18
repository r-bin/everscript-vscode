---
addr: 8CE2AA
kind: code
category: 🧠
name: script_op_88
title: Script opcode 0x88
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands none, continues in the same turn (docs/game-research/script-vm/opcodes.md)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Only the operands and the flow are traced so far; what the handler does with them is not.

Operands: none (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Writes WRAM: `$7E:0B95`; `$7E:0E6C`
- Opcode table entry: `$8C:E9CD` (0x88)
