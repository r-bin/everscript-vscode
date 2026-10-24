---
addr: 8CDE2E
kind: code
category: 🧠
name: script_op_5e_set_object_state_unless_flag
title: Script opcode 0x5e — set object state unless flag
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E u16, continues in the same turn (docs/scripts/opcodes.md)", "disasm: $8C:DE67 after this handler is a second copy of the 0x5C handler that no table entry points to"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x5E](soe://rom/assets/scripts/opcodes/5e.md). Evaluates the object index and reads a 16-bit save-flag ID. If set, it leaves the selected flag bit mask in A as requested state; if clear, it requests `$7F`. It delegates to `$90:A36D` and returns carry set. The set path's mask value is distinct from state `0`. Unused by original scripts (0 statically reachable instructions). Host-side model: `docs/disassembly/script-vm/opcode-5e-object-state-unless-flag.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$90:A36D`
- Reads ROM: `$80:A87F`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$00`
- Opcode table entry: `$8C:E979` (0x5e)
