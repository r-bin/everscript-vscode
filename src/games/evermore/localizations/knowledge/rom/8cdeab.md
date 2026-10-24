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
Handler of script opcode [0x66](soe://rom/assets/scripts/opcodes/66.md). Loads X with `1` for the left speaker slot, calls `$8C:C67C` to wait for the shown state and initiate closing, then returns carry set. Unused by original scripts. Host-side model: `docs/disassembly/script-vm/opcode-66-hide-left-speaker.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:C67C`
- Opcode table entry: `$8C:E989` (0x66)
