---
addr: 8CDE9B
kind: code
category: 🧠
name: script_op_64_show_left_speaker
title: Script opcode 0x64: show the left speaker figure
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler evaluates E into $0B73, sets X to 1 and calls $8C:C627; that helper polls $0B79 and services field ticks on selected wait conditions", "disasm: $8C:C6CB draws $0B73 at (x $18, y $B6) and $0B75 at (x $C6, y $B6) via $80:9033 from entity +$71/+$73; $0B79 bits 1/4/8 and 2/$10/$20 = shown/opening/closing (v0.320.1)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Expression = an entity, stored in `$0B73`; then `$8C:C627` with X = 1 opens the left speaker slot: it waits while the slot is closing (`$0B79` bit 8), then sets bit 4 (opening) with slide timer `$0B7B` = `$E0`. Each frame `$8C:C6CB` draws that entity's figure (`+$71`/`+$73`, palette `+$0C`) at the bottom left of the screen through `$80:9033`. Returns Carry Set.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8C:C627`
- Writes WRAM: `$7E:0B73`
- Opcode table entry: `$8C:E985` (0x64)
