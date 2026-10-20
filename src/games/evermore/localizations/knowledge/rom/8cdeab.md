---
addr: 8CDEAB
kind: code
category: 🧠
name: script_op_66_hide_left_speaker
title: Script opcode 0x66: hide the left speaker figure
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler sets X to 1 and calls $8C:C67C; that helper polls $0B79 using a different set of wait conditions from $8C:C627", "disasm: $8C:C67C X = 1 waits for $0B79 bit 1, then clears it and sets bit 8 (v0.320.1)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x66](soe://rom/assets/scripts/opcodes/66.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/66.md`, served at `soe://rom/assets/scripts/opcodes/66.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:C67C`
- Opcode table entry: `$8C:E989` (0x66)
