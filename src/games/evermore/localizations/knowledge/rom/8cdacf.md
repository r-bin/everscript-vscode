---
addr: 8CDACF
kind: code
category: 🧠
name: unfreeze_boy_and_dog
title: Unfreeze Boy and Dog
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: wrapper selects actor bits 1 and 2; shared helper $8C:DADB calls $8F:CD4D for Boy ($4E89) and Dog ($4F37)", "trace: the game ran 1 distinct instruction with this opcode (tests/script-vm/goldens.json)"]
see: [rom/8fcd4d.md, docs/game-research/script-vm/opcodes.md]
---
With no operands, selects both Boy and Dog actor bits in the shared unfreeze dispatcher. It calls `$8F:CD4D` for `$4E89` and `$4F37`, restoring their motion and clearing immobilization state. Returns Carry Set.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8F:CD4D`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$0D`
- Opcode table entry: `$8C:EA3F` (0xc1)
