---
addr: 8CE6EA
kind: code
category: 🧠
name: script_op_a9_attribute_bit
title: Script opcode 0xA9: set or clear an entity attribute
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E E, continues in the same turn (docs/scripts/opcodes.md)", "trace: the game ran 32 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)", "disasm: JMP ($E6F8,x): $00-$0E -> $E730 (STA +$22), $10-$36 -> set/clear routines on +$10/+$12/+$14; the table ends at $E72E (v0.320.0)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0xA9](soe://rom/assets/scripts/opcodes/a9.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/a9.md`, served at `soe://rom/assets/scripts/opcodes/a9.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Dispatches through: `$8C:E6F8`
- Opcode table entry: `$8C:EA0F` (0xa9)
