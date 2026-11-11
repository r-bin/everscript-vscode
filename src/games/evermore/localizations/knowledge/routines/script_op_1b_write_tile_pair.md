---
addr: 8CD76B
size: 50
end: 8CD79C
kind: code
category: 🧠
name: script_op_1b_write_tile_pair
title: Script opcode 0x1b — write tile pair
confidence: verified
tags: [script-vm, reconstructed-c, g1-pass]
evidence:
  - "[\"disasm: vanilla VFS at $8C:D76B reads two u16 save offsets and two u8 coordinates, scales each coordinate by 8, stores both results as words at $7E:2258+offset, and returns carry set\"]"
  - "Reconstructed in `reconstructed-c/8C/8CD76B_opcode_1b_write_tile_pair.c` (SOE_BIND); passes Gate G1 differential verification (7/7 reference states, 102/102 fuzzed states, mutation caught: yes, 28 / 644 ROM/C instructions per call)."
see: [docs/disassembly/script-vm/opcode-1b-write-tile-pair.md]
---
The handler reads two save offsets and two tile coordinates, scales each coordinate by eight, writes both pixel positions as words, and returns carry set.
