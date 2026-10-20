---
addr: 8CD8FE
kind: code
category: 🧠
name: script_op_48_4b_open_default_message_box
title: Script opcodes 0x48-0x4B: open the default message box
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands none, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "disasm: fixed geometry written to $0361-$0377, then the 0x44 tail at $8C:D941 (v0.320.0)"]
see: [docs/game-research/script-vm/opcodes.md]
---
No operands. Locks the player (`$8C:C543`) and sets up the default window `$034D` at x 2, y 2, 28 x 10 with the player's style `$0B15`, then builds it like opcode `0x44`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:AC8A`; `$8C:C543`
- Reads WRAM: `$7E:0B15`
- Writes WRAM: `$7E:0361`; `$7E:0363`; `$7E:0369`; `$7E:036B`; `$7E:036D`; `$7E:0371`; `$7E:0373`; `$7E:0375`; `$7E:0377`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$04`, `+$06`, `+$08`, `+$0A`, `+$0C`, `+$12`
- Opcode table entries: `$8C:E94D` (0x48), `$8C:E94F` (0x49), `$8C:E951` (0x4a), `$8C:E953` (0x4b)
