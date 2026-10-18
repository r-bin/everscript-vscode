---
addr: 8CDAD4
kind: code
category: 🧠
name: script_op_2d
title: Script opcode 0x2d
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u8, continues in the same turn (docs/game-research/script-vm/opcodes.md)"]
see: [docs/game-research/script-vm/opcodes.md]
---
One byte of bits; bit 3 applies $8F:CD4D to the slot's entity.

Operands: `u8` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.
