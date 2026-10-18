---
addr: 8CD9FD
kind: code
category: 🧠
name: script_op_50_text_in_window
title: Script opcode 0x50 — text in window
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u8 u16, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 30 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Show text: a window byte (record at $034D + $2C * n, $8C:D967), then the string key, looked up by $8C:CCF5 and shown by $8C:9E03.

Operands: `u8 u16` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:9E03`; `$8C:CCF5` Look up a string by key in the string key table ($91:D000), pointer built from two immediates; `$8C:D967`
- Opcode table entry: `$8C:E95D` (0x50)
