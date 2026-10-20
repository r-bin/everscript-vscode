---
addr: 8CDDCB
kind: code
category: 🧠
name: script_op_5c_set_object_state
title: Script opcode 0x5c — set object state
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E E, continues in the same turn (docs/scripts/opcodes.md)", "trace: the game ran 62 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x5C](soe://rom/assets/scripts/opcodes/5c.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/5c.md`, served at `soe://rom/assets/scripts/opcodes/5c.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$90:A36D`
- Opcode table entry: `$8C:E975` (0x5c)
