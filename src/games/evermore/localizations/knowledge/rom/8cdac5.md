---
addr: 8CDAC5
kind: code
category: 🧠
name: unfreeze_boy
title: Unfreeze Boy
confidence: confirmed
tags: [script-vm, entities, boy]
evidence: ["disasm: handler at $8C:DAC5 selects actor bit 1 and enters shared unfreeze helper $8C:DADB, which calls $8F:CD4D for Boy ($4E89)"]
see: [rom/8fcd4d.md, docs/scripts/opcodes.md]
---
Handler of script opcode [0xBD](soe://rom/assets/scripts/opcodes/bd.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/bd.md`, served at `soe://rom/assets/scripts/opcodes/bd.md`.

Previously believed: this address was the per-frame party input/companion AI dispatcher. The opcode-table entry and instructions at `$8C:DAC5` show that this address is the 0xBD unfreeze-Boy handler.

The fixed Boy target and shared unfreeze-helper call are documented in [opcode-freeze.md](../../../../../../docs/disassembly/script-vm/opcode-freeze.md) and modeled by `script_op_unfreeze_boy` in `reconstructed-c/8C/8CDB2A_opcode_freeze.c`.
