---
addr: 8CDDDB
kind: code
category: 🧠
name: script_op_60_next_object_state
title: Script opcode 0x60 — next object state
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E, continues in the same turn (docs/scripts/opcodes.md)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x60](soe://rom/assets/scripts/opcodes/60.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/60.md`, served at `soe://rom/assets/scripts/opcodes/60.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$90:A36D`
- Reads WRAM: `$7E:107E`
- Opcode table entry: `$8C:E97D` (0x60)
