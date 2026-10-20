---
addr: 8CD8FE
kind: code
category: 🧠
name: script_op_48_4b_open_default_message_box
title: Script opcodes 0x48-0x4B: open the default message box
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands none, continues in the same turn (docs/scripts/opcodes.md)", "disasm: fixed geometry written to $0361-$0377, then the 0x44 tail at $8C:D941 (v0.320.0)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcodes [0x48](soe://rom/assets/scripts/opcodes/48.md), [0x49](soe://rom/assets/scripts/opcodes/49.md), [0x4A](soe://rom/assets/scripts/opcodes/4a.md), [0x4B](soe://rom/assets/scripts/opcodes/4b.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/48.md`, served at `soe://rom/assets/scripts/opcodes/48.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:AC8A`; `$8C:C543`
- Reads WRAM: `$7E:0B15`
- Writes WRAM: `$7E:0361`; `$7E:0363`; `$7E:0369`; `$7E:036B`; `$7E:036D`; `$7E:0371`; `$7E:0373`; `$7E:0375`; `$7E:0377`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$04`, `+$06`, `+$08`, `+$0A`, `+$0C`, `+$12`
- Opcode table entries: `$8C:E94D` (0x48), `$8C:E94F` (0x49), `$8C:E951` (0x4a), `$8C:E953` (0x4b)
