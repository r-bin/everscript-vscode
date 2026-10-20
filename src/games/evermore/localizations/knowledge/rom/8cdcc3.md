---
addr: 8CDCC3
kind: code
category: 🧠
name: script_op_c2_spawn_spawner
title: Script opcode 0xc2 — spawn spawner
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u8 u8 u8, continues in the same turn (docs/scripts/opcodes.md)", "trace: the game ran 30 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)", "recomp: clean C in docs/disassembly/script-vm/opcode-spawning.md"]
see: [docs/scripts/opcodes.md, rom/8cdd19.md, rom/8eb55a.md, rom/8fa933.md, rom/8fb094.md, rom/8fde98.md]
---
Handler of script opcode [0xC2](soe://rom/assets/scripts/opcodes/c2.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/c2.md`, served at `soe://rom/assets/scripts/opcodes/c2.md`.
