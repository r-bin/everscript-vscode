---
addr: 8CDCD9
kind: code
category: 🧠
name: script_op_ba_spawn
title: Script opcode 0xba — spawn
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u8 u8 u8, continues in the same turn (docs/scripts/opcodes.md)", "trace: the game ran 57 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)", "recomp: clean C in docs/disassembly/script-vm/opcode-spawning.md"]
see: [docs/scripts/opcodes.md, rom/8cdd19.md, rom/8eb55a.md, rom/8fa933.md, rom/8fb094.md, rom/8fde98.md]
---
Handler of script opcode [0xBA](soe://rom/assets/scripts/opcodes/ba.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/ba.md`, served at `soe://rom/assets/scripts/opcodes/ba.md`.
