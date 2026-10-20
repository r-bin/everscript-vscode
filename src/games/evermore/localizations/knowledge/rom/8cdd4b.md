---
addr: 8CDD4B
kind: code
category: 🧠
name: script_op_3d_attach_talk_script
title: Script opcode 0x3D: give an entity a talk script
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E u16, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 20 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)", "disasm: $8F:AC0E tests +$68 bit $0040 and the Boy's distance (< $21 px) before running +$66 (v0.320.0)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Entity expression and a word: the word (a trigger id, an offset into the script pointer table at `$92:8000`) goes to the entity's event script `+$66`, and its event mask `+$68` becomes `$0040` (talk: B button near the entity). The 4-byte short form of opcode `0x3F` for NPCs.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$66`, `+$68`
- Opcode table entry: `$8C:E937` (0x3d)
