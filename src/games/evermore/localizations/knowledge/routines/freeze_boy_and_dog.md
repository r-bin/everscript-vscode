---
addr: 8CDB25
size: 5
end: 8CDB29
kind: code
category: 🧠
name: freeze_boy_and_dog
title: Freeze Boy and Dog
confidence: verified
tags: [script-vm, reconstructed-c, g1-pass]
evidence:
  - "[\"disasm: wrapper selects actor bits 1 and 2; shared helper $8C:DB31 calls $8F:CD78 for Boy ($4E89) and Dog ($4F37)\", \"trace: the game ran 7 distinct instructions with this opcode (tests/script-vm/goldens.json)\"]"
  - "Reconstructed in `reconstructed-c/8C/8CDB25_freeze_boy_and_dog.c` (SOE_BIND); passes Gate G1 differential verification (12/12 reference states, 0/0 fuzzed states, mutation caught: yes, 39 / 883 ROM/C instructions per call)."
see: [routines/entity_freeze_immobilize.md, docs/scripts/opcodes.md]
---
Handler of script opcode [0xC0](soe://rom/assets/scripts/opcodes/c0.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/c0.md`, served at `soe://rom/assets/scripts/opcodes/c0.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8F:CD78`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$0D`
- Opcode table entry: `$8C:EA3D` (0xc0)

The mask-3 Boy-then-Dog dispatch is documented in [opcode-freeze.md](../../../../../../docs/disassembly/script-vm/opcode-freeze.md) and modeled by `script_op_freeze_boy_and_dog` in `reconstructed-c/8C/8CDB2A_opcode_freeze.c`.
