---
addr: 8CDBB9
kind: code
category: 🧠
name: script_op_21_warp_in_room
title: Script opcode 0x21 — warp in room
confidence: confirmed
tags: [script-vm, camera, maps]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u8 u8, ends the script (docs/scripts/opcodes.md)", "trace: script opcode 0x21 camera warp with fade"]
see: [docs/scripts/opcodes.md, rom/8fb434.md, rom/8cdb71.md, rom/8cdbf0.md, docs/disassembly/script-vm/opcode-camera-room.md]
---
Handler of script opcode [0x21](soe://rom/assets/scripts/opcodes/21.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/21.md`, served at `soe://rom/assets/scripts/opcodes/21.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$80:85D8`; `$8C:CE99` Script VM — start the room's enter script; `$8C:CEE9` Script VM — stop every thread; `$8F:B38E`; `$8F:B434`
- Opcode table entry: `$8C:E8FF` (0x21)
