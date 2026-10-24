---
addr: 8CD9FD
kind: code
category: 🧠
name: script_op_50_text_in_window
title: Script opcode 0x50 — text in window
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: opcode table entry $8C:E95D dispatches to $8C:D9FD; operands u8 u16, continues in the same turn (docs/scripts/opcodes.md)", "trace: the game ran 30 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/scripts/opcodes.md]
---
Handler of script opcode [0x50](soe://rom/assets/scripts/opcodes/50.md). It resolves a selected window record, consumes a 16-bit dialogue string key, unpacks the string through `$8C:CCF5`, and renders it through `$8C:9E03`. The host-side model is documented in `docs/disassembly/script-vm/opcode-50-51-text.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:9E03`; `$8C:CCF5` Look up a string by key in the string key table ($91:D000), pointer built from two immediates; `$8C:D967`
- Opcode table entry: `$8C:E95D` (0x50)
