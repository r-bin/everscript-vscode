---
addr: 8CDACF
kind: code
category: 🧠
name: unfreeze_boy_and_dog
title: Unfreeze Boy and Dog
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: wrapper selects actor bits 1 and 2; shared helper $8C:DADB calls $8F:CD4D for Boy ($4E89) and Dog ($4F37)", "trace: the game ran 1 distinct instruction with this opcode (tests/script-vm/goldens.json)"]
see: [rom/8fcd4d.md, docs/scripts/opcodes.md]
---
Handler of script opcode [0xC1](soe://rom/assets/scripts/opcodes/c1.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/c1.md`, served at `soe://rom/assets/scripts/opcodes/c1.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8F:CD4D`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$0D`
- Opcode table entry: `$8C:EA3F` (0xc1)

The mask-3 Boy-then-Dog dispatch is documented in [opcode-freeze.md](../../../../../../docs/disassembly/script-vm/opcode-freeze.md) and modeled by `script_op_unfreeze_boy_and_dog` in `reconstructed-c/8C/8CDB2A_opcode_freeze.c`.
