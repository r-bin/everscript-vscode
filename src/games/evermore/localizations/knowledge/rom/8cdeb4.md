---
addr: 8CDEB4
kind: code
category: 🧠
name: script_op_65_reshow_left_speaker
title: Script opcode 0x65: show the left speaker figure again
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler sets X to 1 and calls $8C:C627; that helper polls $0B79 and services field ticks on selected wait conditions", "disasm: $8C:C6CB draws $0B73 at (x $18, y $B6) and $0B75 at (x $C6, y $B6) via $80:9033 from entity +$71/+$73; $0B79 bits 1/4/8 and 2/$10/$20 = shown/opening/closing (v0.320.1)"]
see: [docs/game-research/script-vm/opcodes.md]
---
`$8C:C627` with X = 1, keeping the entity already in `$0B73` (see opcode `0x64`).

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:C627`
- Opcode table entry: `$8C:E987` (0x65)
