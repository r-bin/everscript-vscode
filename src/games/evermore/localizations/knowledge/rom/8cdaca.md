---
addr: 8CDACA
kind: code
category: 🧠
name: unfreeze_dog
title: Unfreeze Dog
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: wrapper selects actor bit 2 and shared helper $8C:DADB calls $8F:CD4D for Dog to restore motion and clear immobilization state", "trace: the game ran 4 distinct instructions with this opcode (tests/script-vm/goldens.json)"]
see: [rom/8fcd4d.md, docs/scripts/opcodes.md]
---
Handler of script opcode [0xBF](soe://rom/assets/scripts/opcodes/bf.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/bf.md`, served at `soe://rom/assets/scripts/opcodes/bf.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8F:CD4D`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$0D`
- Opcode table entry: `$8C:EA3B` (0xbf)
