---
addr: 8CDF1D
kind: code
category: 🧠
name: script_op_71_face_away_from_entity
title: Script opcode 0x71 — face away from entity
confidence: confirmed
tags: [script-vm, entities]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E E (target, source); evaluates both entities via $8C:EC8E, calls $8C:DF33 to compute compass vector, then flips angle 180 degrees (EOR #8) to face away from target, storing to source +0x22", "recomp: clean C in docs/disassembly/script-vm/opcode-facing.md"]
see: [docs/game-research/script-vm/opcodes.md, rom/8cdf33.md, rom/8cdf0d.md]
---
Directs a source entity to rotate and face 180 degrees directly away from a target entity:
- Evaluates operand 1 (target entity) into register Y.
- Evaluates operand 2 (source entity) into register Y (stashing target in X).
- Invokes `$8C:DF33` (`entity_compute_facing_towards`) to compute the dominant vector delta.
- Inverts the direction by 180 degrees via `EOR #$0008`:
  - North (`0`) -> South (`8`)
  - East (`4`) -> West (`12`)
  - South (`8`) -> North (`0`)
  - West (`12`) -> East (`4`)
- Updates source entity's facing direction field at `+0x22`.
- Continues in the same VM turn (`SEC; RTS`).
- Full clean C decompilation: `docs/disassembly/script-vm/opcode-facing.md`.

