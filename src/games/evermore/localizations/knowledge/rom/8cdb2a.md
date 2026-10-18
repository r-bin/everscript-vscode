---
addr: 8CDB2A
kind: code
category: 🧠
name: script_op_2c
title: Script opcode 0x2c
confidence: confirmed
tags: [script-vm, cutscene, immobilization]
evidence: ["disasm: handler from opcode table at $8C:E8BD; operand u8 mask (bit 3: bound entity, bit 0: boy, bit 1: dog); invokes $8F:CD78; returns SEC (continue turn)", "docs/disassembly/script-vm/opcode-freeze.md"]
see: [docs/disassembly/script-vm/opcode-freeze.md, docs/game-research/script-vm/opcodes.md]
---
Script opcode 0x2C cutscene immobilization handler. Reads an 8-bit mask operand:
- Bit 3 (`0x08`): Freezes the entity bound to current thread slot (`+$0D`).
- Bit 0 (`0x01`): Freezes Boy player character (`$7E:4E89`).
- Bit 1 (`0x02`): Freezes Dog companion character (`$7E:4F37`).

Invokes `entity_freeze_immobilize` (`$8F:CD78`) for each matched entity, which halts physics/motion and sets status flag bit 5 (`0x0020`).
Returns Carry Set (`SEC`) to continue executing instructions within the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8F:CD78`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$0D`
- Opcode table entry: `$8C:E915` (0x2c)
