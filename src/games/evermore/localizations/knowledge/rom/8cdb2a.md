---
addr: 8CDB2A
kind: code
category: 🧠
name: script_op_2c
title: Script opcode 0x2c
confidence: confirmed
tags: [script-vm, cutscene, immobilization]
evidence: ["disasm: handler from opcode table at $8C:E8BD; operand u8 mask (bit 3: bound entity, bit 0: boy, bit 1: dog); invokes $8F:CD78; returns SEC (continue turn)", "docs/disassembly/script-vm/opcode-freeze.md"]
see: [docs/disassembly/script-vm/opcode-freeze.md, docs/scripts/opcodes.md]
---
Handler of script opcode [0x2C](soe://rom/assets/scripts/opcodes/2c.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/2c.md`, served at `soe://rom/assets/scripts/opcodes/2c.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8F:CD78`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$0D`
- Opcode table entry: `$8C:E915` (0x2c)
