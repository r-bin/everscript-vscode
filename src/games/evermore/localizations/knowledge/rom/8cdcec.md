---
addr: 8CDCEC
end: 8CDD18
kind: code
category: 🧠
name: script_op_3c_spawn
title: Script opcode 0x3c — spawn
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u16 u16 u8 u8, continues in the same turn (docs/scripts/opcodes.md)", "trace: the game ran 12 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)", "recomp: clean C in docs/disassembly/script-vm/opcode-spawning.md"]
see: [docs/scripts/opcodes.md, rom/8cdd19.md, rom/8eb55a.md, rom/8fa933.md, rom/8fb094.md, rom/8fde98.md]
---
Handler of script opcode [0x3C](soe://rom/assets/scripts/opcodes/3c.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/3c.md`, served at `soe://rom/assets/scripts/opcodes/3c.md`.
