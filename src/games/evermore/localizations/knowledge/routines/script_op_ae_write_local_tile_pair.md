---
addr: 8CD71F
size: 51
end: 8CD751
kind: code
category: 🧠
name: script_op_ae_write_local_tile_pair
title: Script opcode 0xae — write local tile pair
confidence: verified
tags: [script-vm, reconstructed-c, g1-pass]
evidence: "[\"disasm: handler from the opcode table at $8C:E8BD; operands u8 u8 u8 u8, continues in the same turn (docs/scripts/opcodes.md)\", \"trace: the game ran 8 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)\"]; G1 pass (11/11 reference states, 169/169 fuzzed states, mutation caught)"
see: [docs/scripts/opcodes.md, docs/disassembly/script-vm/opcode-ae-write-arg-tile-pair.md]
---
Handler of script opcode [0xAE](soe://rom/assets/scripts/opcodes/ae.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/ae.md`, served at `soe://rom/assets/scripts/opcodes/ae.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$00`
- Opcode table entry: `$8C:EA19` (0xae)

The byte-offset calculation and tile scaling are documented in [opcode-ae-write-arg-tile-pair.md](../../../../../../docs/disassembly/script-vm/opcode-ae-write-arg-tile-pair.md) and modeled in `reconstructed-c/8C/8CD71F_opcode_ae_write_arg_tile_pair.c`.
