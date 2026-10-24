---
addr: 8CE2AA
kind: code
category: 🧠
name: reset_catalog_parameter_state
title: Reset catalog parameter state
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: no-operand handler writes $FFFF to $0B95, clears $0E6C, and returns Carry Set"]
see: [docs/scripts/vm.md, docs/scripts/opcodes.md, docs/disassembly/script-vm/opcode-88-clear-shop.md]
---
Handler of script opcode [0x88](soe://rom/assets/scripts/opcodes/88.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/88.md`, served at `soe://rom/assets/scripts/opcodes/88.md`.

The C control-flow model is in [opcode-88-clear-shop.md](../../../../../../docs/disassembly/script-vm/opcode-88-clear-shop.md) and `reconstructed-c/8C/8CE2AA_opcode_88_clear_shop.c`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Writes WRAM: `$7E:0B95`; `$7E:0E6C`
- Opcode table entry: `$8C:E9CD` (0x88)
