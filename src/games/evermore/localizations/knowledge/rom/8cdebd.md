---
addr: 8CDEBD
kind: code
category: 🧠
name: script_op_68_show_right_speaker
title: Script opcode 0x68: show the right speaker figure
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler evaluates E into $0B75, sets X to 2 and calls $8C:C627; that helper polls $0B79 and services field ticks on selected wait conditions", "disasm: $8C:C6CB draws $0B73 at (x $18, y $B6) and $0B75 at (x $C6, y $B6) via $80:9033 from entity +$71/+$73; $0B79 bits 1/4/8 and 2/$10/$20 = shown/opening/closing (v0.320.1)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x68](soe://rom/assets/scripts/opcodes/68.md). Evaluates an entity expression, stores it at `$7E:0B75`, sets X to `2` for the right speaker slot, calls `$8C:C627` to manage portrait state/drawing, then returns carry set. Unused by original scripts (0 statically reachable instructions). Host-side model: `docs/disassembly/script-vm/opcode-68-show-right-speaker.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8C:C627`
- Writes WRAM: `$7E:0B75`
- Opcode table entry: `$8C:E98D` (0x68)
