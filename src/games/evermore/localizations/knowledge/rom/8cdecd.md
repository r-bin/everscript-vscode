---
addr: 8CDECD
kind: code
category: 🧠
name: script_op_6a_hide_right_speaker
title: Script opcode 0x6A: hide the right speaker figure
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler sets X to 2 and calls $8C:C67C; that helper polls $0B79 using a different set of wait conditions from $8C:C627", "disasm: $8C:C67C X = 2 waits for $0B79 bit 2, then clears it and sets $20 (v0.320.1)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x6A](soe://rom/assets/scripts/opcodes/6a.md). Loads X with `2` for the right speaker slot, calls `$8C:C67C` to wait for the shown state and initiate closing, then returns carry set. Unused by original scripts. Host-side model: `docs/disassembly/script-vm/opcode-6a-hide-right-speaker.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:C67C`
- Opcode table entry: `$8C:E991` (0x6a)
