---
addr: 8CDE2E
kind: code
category: 🧠
name: script_op_5e_set_object_state_unless_flag
title: Script opcode 0x5e — set object state unless flag
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E u16, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "disasm: $8C:DE67 after this handler is a second copy of the 0x5C handler that no table entry points to"]
see: [docs/game-research/script-vm/opcodes.md]
---
The same as opcode `0x5D` with the flag's meaning reversed: highest state (`$7F`, clamped) when the save flag is clear, 0 when it is set.

Right after it, `$8C:DE67`-`$DE76` is an unreachable copy of the `0x5C` handler (object = expression, state = expression, `$90:A36D`): dead code from a removed opcode.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$90:A36D`
- Reads ROM: `$80:A87F`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$00`
- Opcode table entry: `$8C:E979` (0x5e)
