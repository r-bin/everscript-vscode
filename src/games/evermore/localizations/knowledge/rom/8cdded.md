---
addr: 8CDDED
kind: code
category: 🧠
name: script_op_61_previous_object_state
title: Script opcode 0x61 — previous object state
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E, continues in the same turn (docs/scripts/opcodes.md)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x61](soe://rom/assets/scripts/opcodes/61.md). Evaluates an object index, reads `$7E:107E,X`, masks to the low byte, decrements A using 16-bit semantics (`0` becomes `$FFFF`), then delegates the requested target to `$90:A36D`. Returns carry set. Unused by original scripts (0 statically reachable instructions). Host-side model: `docs/disassembly/script-vm/opcode-61-previous-object-state.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$90:A36D`
- Reads WRAM: `$7E:107E`
- Opcode table entry: `$8C:E97F` (0x61)
