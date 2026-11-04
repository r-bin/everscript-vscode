---
addr: 8CDF1D
size: 22
end: 8CDF32
kind: code
category: 🧠
name: script_op_71_face_away_from_entity
title: Script opcode 0x71 — face away from entity
confidence: confirmed
tags: [script-vm, entities]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E E (target, source); evaluates both entities via $8C:EC8E, calls $8C:DF33 to compute compass vector, then flips angle 180 degrees (EOR #8) to face away from target, storing to source +0x22", "recomp: clean C in docs/disassembly/script-vm/opcode-facing.md"]
see: [docs/scripts/opcodes.md, routines/entity_compute_facing_towards.md, routines/script_op_70_face_towards_entity.md]
---
Handler of script opcode [0x71](soe://rom/assets/scripts/opcodes/71.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/71.md`, served at `soe://rom/assets/scripts/opcodes/71.md`.
