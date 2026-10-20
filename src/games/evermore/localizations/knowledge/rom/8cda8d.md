---
addr: 8CDA8D
kind: code
category: 🧠
name: script_op_73_walk_to_direct
title: Script opcode 0x73: walk an entity to a point, ignoring terrain
confidence: confirmed
tags: [script-vm]
evidence: ["trace: the game ran 2 distinct instructions with this opcode (tests/script-vm/goldens.json)", "disasm: PEA $0001 -> DP $12 selects $8F:AAD3 (v0.320.0)"]
see: [docs/scripts/vm.md, docs/scripts/opcodes.md]
---
Handler of script opcode [0x73](soe://rom/assets/scripts/opcodes/73.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/73.md`, served at `soe://rom/assets/scripts/opcodes/73.md`.

Previously believed: the coordinates were only staged.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8F:AA82`; `$8F:AAD3`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$2A`
- Opcode table entry: `$8C:E9A3` (0x73)
