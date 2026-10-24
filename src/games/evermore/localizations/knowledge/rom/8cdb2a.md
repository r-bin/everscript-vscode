---
addr: 8CDB2A
end: 8CDB66
kind: code
category: 🧠
name: script_op_2c_freeze_mask
title: Script opcode 0x2c freezes entities by mask
confidence: confirmed
tags: [script-vm, cutscene, immobilization]
evidence: ["disasm: vanilla VFS at $8C:DB2A reads a u8 mask; bits 3, 0, and 1 select the current thread's bound entity, Boy, and Dog in that order; selected entities pass through $8F:CD78; returns SEC", "opcode table: $8C:E915 maps 0x2c to $8C:DB2A"]
see: [docs/disassembly/script-vm/opcode-freeze.md, docs/disassembly/script-vm/opcode-29-call.md]
---
The handler conditionally freezes the current thread's bound entity, Boy, then Dog according to operand bits `0x08`, `0x01`, and `0x02`, respectively. Before each `$8F:CD78` call it stores the selected entity pointer in DP `$4C`.

The clean C model is `script_op_2c_freeze_mask` in the shared freeze module.
