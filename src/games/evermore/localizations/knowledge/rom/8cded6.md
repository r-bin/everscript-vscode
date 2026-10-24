---
addr: 8CDED6
kind: code
category: 🧠
name: script_op_69_reshow_right_speaker
title: Script opcode 0x69: show the right speaker figure again
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler sets X to 2 and calls $8C:C627; that helper polls $0B79 and services field ticks on selected wait conditions", "disasm: $8C:C6CB draws $0B73 at (x $18, y $B6) and $0B75 at (x $C6, y $B6) via $80:9033 from entity +$71/+$73; $0B79 bits 1/4/8 and 2/$10/$20 = shown/opening/closing (v0.320.1)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x69](soe://rom/assets/scripts/opcodes/69.md). Loads X with `2` for the right speaker slot, calls `$8C:C627` using the entity stored at `$7E:0B75`, and returns carry set without changing the stored entity. Unused by original scripts. Host-side model: `docs/disassembly/script-vm/opcode-69-reshow-right-speaker.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:C627`
- Opcode table entry: `$8C:E98F` (0x69)
