---
addr: 8CDAD4
kind: code
category: 🧠
name: script_op_2d_unfreeze_mask
title: Script opcode 0x2D: unfreeze by mask
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u8, continues in the same turn (docs/scripts/opcodes.md)", "disasm: bits $08 slot entity, $01 Boy ($4E89), $02 Dog ($4F37), each $8F:CD4D (v0.320.0)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x2D](soe://rom/assets/scripts/opcodes/2d.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/2d.md`, served at `soe://rom/assets/scripts/opcodes/2d.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8F:CD4D`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$0D`
- Opcode table entry: `$8C:E917` (0x2d)
