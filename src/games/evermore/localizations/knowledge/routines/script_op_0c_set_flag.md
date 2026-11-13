---
addr: 8CD83E
size: 62
end: 8CD87B
kind: code
category: 🧠
name: script_op_0c_set_flag
title: Script opcode 0x0C sets or clears a save-area flag
confidence: verified
tags: [script-vm, reconstructed-c, g1-pass]
evidence:
  - "[\"disasm: vanilla VFS at $8C:D83E reads a u16 bit index, computes $7E:2258+(index>>3), and shares the set/clear tail at $8C:D84C with opcode 0x0E\", \"vm: nonzero expression sets the selected bit, zero clears it, and both paths return carry set\"]"
  - "Reconstructed in `reconstructed-c/8C/8CD83E_opcode_0c_set_flag.c` (SOE_BIND); passes Gate G1 differential verification (43/43 reference states, 428/428 fuzzed states, mutation caught: yes, 46 / 498 ROM/C instructions per call)."
see: [docs/disassembly/script-vm/opcode-0c-set-flag.md]
---
The handler reads a 16-bit bit index, computes the corresponding byte in the save-flag area beginning at `$7E:2258`, and sets or clears the selected bit according to expression truthiness. The set/clear update tail at `$8C:D84C` is shared with opcode `0x0E`, which targets thread argument bytes instead.
