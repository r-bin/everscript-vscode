---
addr: 8CDDB0
kind: code
category: 🧠
name: script_op_4e_bind_entity
title: Script opcode 0x4e — bind entity
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E, continues in the same turn (docs/game-research/script-vm/opcodes.md)"]
see: [docs/game-research/script-vm/opcodes.md]
---
The slot's entity (slot + $0D) becomes the entity expression (reference counts at entity +$3E follow).

Operands: `E` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.
