---
addr: 8CDDED
kind: code
category: 🧠
name: script_op_61_previous_object_state
title: Script opcode 0x61 — previous object state
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E, continues in the same turn (docs/game-research/script-vm/opcodes.md)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Map object (expression) goes to its target state - 1.

Operands: `E` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$90:A36D`
- Reads WRAM: `$7E:107E`
- Opcode table entry: `$8C:E97F` (0x61)
