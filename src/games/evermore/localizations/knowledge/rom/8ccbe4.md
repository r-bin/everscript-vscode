---
addr: 8CCBE4
kind: code
category: 🧠
name: tile_decoder_op93_phase2_exit_test
title: Opcode 0x93 tile decoder pass 2 bit-8 completion test
confidence: confirmed
tags: [maps, graphics, tiles, vram]
evidence: ["disasm: $8C:CBE4 tests bit 8 of the VRAM address register after pass 2 to determine if both 32-word passes of opcode 0x93 are finished, then executes RTL", "src/games/evermore/maps/render-trace-93.ts"]
see: [rom/8cca99.md, rom/8ccaf0.md]
---
Checks completion of opcode 0x93 tile streaming by inspecting the bit-8 phase state. Once both 32-word streams (totaling 64 VRAM words) have been emitted, exits via `RTL` at `$8C:CBFF`.

## Addresses
- Exit Instruction: `$8C:CBFF` (`RTL`)
- Inter-pass Transition: `$8C:CAF0`
