---
addr: 8CDFEE
kind: code
category: 🧠
name: script_op_42_teleport_tile
title: Script opcode 0x42: teleport an entity to a tile
confidence: confirmed
tags: [script-vm]
evidence: ["opcode table: $8C:E941 dispatches opcode 0x42 to $8C:DFEE", "disasm: entity expression followed by packed u16 tile coordinate; low and high bytes are each shifted left 3 into DP $46 and $48, then execution joins the shared tail at $8C:E01D", "disasm: shared tail skips when entity +$10 bit $0008 is set; otherwise it uses and clears nonnegative $23DB as the layer override for $8F:C2E4, or calls $8F:C2D1 when the override is negative"]
see: [docs/disassembly/script-vm/opcode-42-43-teleport.md, docs/scripts/opcodes.md]
---
Handler of script opcode [0x42](soe://rom/assets/scripts/opcodes/42.md). It scales the packed tile bytes to pixel coordinates and uses the shared teleport tail. The host-side model is documented in `docs/disassembly/script-vm/opcode-42-43-teleport.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8F:C2D1`; `$8F:C2E4`
- Reads WRAM: `$7E:23DB` in Persistent RAM across rooms (names, story flags, markets, alchemy) (+$1DB)
- Writes WRAM: `$7E:23DB` in Persistent RAM across rooms (names, story flags, markets, alchemy) (+$1DB)
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$10`
- Opcode table entry: `$8C:E941` (0x42)
