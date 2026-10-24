---
addr: 8CD8FE
kind: code
category: 🧠
name: script_op_48_4b_open_default_message_box
title: Script opcodes 0x48-0x4B: open the default message box
confidence: likely
tags: [script-vm]
evidence: ["opcode table: $8C:E94D, $8C:E94F, $8C:E951, and $8C:E953 dispatch to $8C:D8FE", "disasm: $8C:D8FE locks player input and initializes default window record $7E:034D with fixed fields including +$14=2, +$16=2, +$1C=$001C, +$1E=$000A, +$20=$0050, and style +$26 from $0B15", "disasm: shared initialization tail calls $8C:AC8A, preserves +$12 flags, restores the data bank, and returns carry set"]
see: [docs/disassembly/script-vm/opcode-44-47-open-message-box.md, docs/scripts/opcodes.md]
---
Handler of script opcodes [0x48](soe://rom/assets/scripts/opcodes/48.md), [0x49](soe://rom/assets/scripts/opcodes/49.md), [0x4A](soe://rom/assets/scripts/opcodes/4a.md), and [0x4B](soe://rom/assets/scripts/opcodes/4b.md). It opens the fixed default window record; the host-side model is documented in `docs/disassembly/script-vm/opcode-44-47-open-message-box.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:AC8A`; `$8C:C543`
- Reads WRAM: `$7E:0B15`
- Writes WRAM: `$7E:0361`; `$7E:0363`; `$7E:0369`; `$7E:036B`; `$7E:036D`; `$7E:0371`; `$7E:0373`; `$7E:0375`; `$7E:0377`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$04`, `+$06`, `+$08`, `+$0A`, `+$0C`, `+$12`
- Opcode table entries: `$8C:E94D` (0x48), `$8C:E94F` (0x49), `$8C:E951` (0x4a), `$8C:E953` (0x4b)
