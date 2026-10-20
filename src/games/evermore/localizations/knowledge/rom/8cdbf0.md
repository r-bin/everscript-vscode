---
addr: 8CDBF0
kind: code
category: 🧠
name: script_op_20_place_camera_tile
title: Script opcode 0x20 — place camera tile
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u8 u8, continues in the same turn (docs/scripts/opcodes.md)", "trace: the game ran 5 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/scripts/opcodes.md, rom/8fb434.md, rom/8cdb71.md, rom/8cdbb9.md, docs/disassembly/script-vm/opcode-camera-room.md]
---
Handler of script opcode [0x20](soe://rom/assets/scripts/opcodes/20.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/20.md`, served at `soe://rom/assets/scripts/opcodes/20.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8F:B434`
- Opcode table entry: `$8C:E8FD` (0x20)
