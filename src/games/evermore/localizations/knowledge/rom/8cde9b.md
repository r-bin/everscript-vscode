---
addr: 8CDE9B
kind: code
category: 🧠
name: script_op_64_show_left_speaker
title: Script opcode 0x64: show the left speaker figure
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler evaluates E into $0B73, sets X to 1 and calls $8C:C627; that helper polls $0B79 and services field ticks on selected wait conditions", "disasm: $8C:C6CB draws $0B73 at (x $18, y $B6) and $0B75 at (x $C6, y $B6) via $80:9033 from entity +$71/+$73; $0B79 bits 1/4/8 and 2/$10/$20 = shown/opening/closing (v0.320.1)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x64](soe://rom/assets/scripts/opcodes/64.md). Evaluates an entity expression, stores it at `$7E:0B73`, sets X to `1` for the left speaker slot, and calls `$8C:C627` to manage portrait state/drawing. Returns carry set. Unused by original scripts (0 statically reachable instructions). Host-side model: `docs/disassembly/script-vm/opcode-64-show-left-speaker.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8C:C627`
- Writes WRAM: `$7E:0B73`
- Opcode table entry: `$8C:E985` (0x64)
