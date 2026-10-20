---
addr: 8CDEBD
kind: code
category: 🧠
name: set_0b75_and_poll_state
title: Set $0B75 and poll field state
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler evaluates E into $0B75, sets X to 2 and calls $8C:C627; that helper polls $0B79 and services field ticks on selected wait conditions"]
see: [docs/game-research/script-vm/opcodes.md]
---
Evaluates its `E` operand into `$0B75`, then calls `$8C:C627` with X set to 2. The helper polls selected `$0B79` bits and advances field ticks while waiting on its internal conditions. The opcode returns Carry Set after the helper; the meaning of `$0B75` is not established here.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8C:C627`
- Writes WRAM: `$7E:0B75`
- Opcode table entry: `$8C:E98D` (0x68)
