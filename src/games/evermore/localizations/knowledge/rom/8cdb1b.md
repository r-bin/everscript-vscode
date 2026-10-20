---
addr: 8CDB1B
kind: code
category: 🧠
name: freeze_boy
title: Freeze Boy
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: wrapper selects actor bit 1 and shared helper $8C:DB31 calls $8F:CD78 to halt motion and set the immobilized flag", "trace: the game ran 3 distinct instructions with this opcode (tests/script-vm/goldens.json)"]
see: [rom/8fcd78.md, docs/game-research/script-vm/opcodes.md]
---
With no operands, selects Boy's actor bit in the shared freeze dispatcher. The dispatcher sets DP `$4C` to Boy (`$4E89`) and calls `$8F:CD78` to halt his motion and set the immobilized flag. Returns Carry Set.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8F:CD78`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$0D`
- Opcode table entry: `$8C:EA35` (0xbc)
