---
addr: 8CDAD4
end: 8CDB10
kind: code
category: 🧠
name: script_op_2d_unfreeze_mask
title: Script opcode 0x2d unfreezes entities by mask
confidence: confirmed
tags: [script-vm, cutscene, immobilization]
evidence: ["disasm: vanilla VFS at $8C:DAD4 reads a u8 mask; bits 3, 0, and 1 select the current thread's bound entity, Boy, and Dog in that order; selected entities pass through $8F:CD4D; returns SEC", "opcode table: $8C:E917 maps 0x2d to $8C:DAD4"]
see: [docs/disassembly/script-vm/opcode-freeze.md, docs/disassembly/script-vm/opcode-29-call.md]
---
The handler reads an operand mask and unfreezes the current thread's bound entity, Boy, then Dog according to bits `0x08`, `0x01`, and `0x02`. Before each `$8F:CD4D` call it stores the selected entity pointer in DP `$4C`.

The clean C model is `script_op_2d_unfreeze_mask` in the shared freeze module.
