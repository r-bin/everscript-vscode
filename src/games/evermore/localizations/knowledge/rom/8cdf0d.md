---
addr: 8CDF0D
kind: code
category: 🧠
name: script_op_70_face_towards_entity
title: Script opcode 0x70 — face towards entity
confidence: confirmed
tags: [script-vm, entities]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E E (target, source); evaluates both entities via $8C:EC8E, calls $8C:DF33 to compute 4-way compass orientation towards target, and updates source entity +0x22", "recomp: clean C in docs/disassembly/script-vm/opcode-facing.md"]
see: [docs/game-research/script-vm/opcodes.md, rom/8cdf33.md, rom/8cdf1d.md]
---
Directs a source entity to rotate and face toward a target entity:
- Evaluates operand 1 (target entity) into register Y.
- Evaluates operand 2 (source entity) into register Y (stashing target in X).
- Invokes `$8C:DF33` (`entity_compute_facing_towards`) to compute the dominant vector delta.
- Updates source entity's facing direction field at `+0x22` with compass code: North (`0`), East (`4`), South (`8`), or West (`12`).
- Continues in the same VM turn (`SEC; RTS`).
- Full clean C decompilation: `docs/disassembly/script-vm/opcode-facing.md`.

