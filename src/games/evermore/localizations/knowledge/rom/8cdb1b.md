---
addr: 8CDB1B
kind: code
category: 🧠
name: freeze_boy
title: Freeze Boy
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: wrapper selects actor bit 1 and shared helper $8C:DB31 calls $8F:CD78 to halt motion and set the immobilized flag", "trace: the game ran 3 distinct instructions with this opcode (tests/script-vm/goldens.json)"]
see: [rom/8fcd78.md, docs/scripts/opcodes.md]
---
Handler of script opcode [0xBC](soe://rom/assets/scripts/opcodes/bc.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/bc.md`, served at `soe://rom/assets/scripts/opcodes/bc.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8F:CD78`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$0D`
- Opcode table entry: `$8C:EA35` (0xbc)
