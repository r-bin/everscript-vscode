---
addr: 8CDF0D
kind: code
category: 🧠
name: script_op_70_face_towards_entity
title: Script opcode 0x70 — face towards entity
confidence: confirmed
tags: [script-vm, entities]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E E (target, source); evaluates both entities via $8C:EC8E, calls $8C:DF33 to compute 4-way compass orientation towards target, and updates source entity +0x22", "recomp: clean C in docs/disassembly/script-vm/opcode-facing.md"]
see: [docs/scripts/opcodes.md, rom/8cdf33.md, rom/8cdf1d.md]
---
Handler of script opcode [0x70](soe://rom/assets/scripts/opcodes/70.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/70.md`, served at `soe://rom/assets/scripts/opcodes/70.md`.
