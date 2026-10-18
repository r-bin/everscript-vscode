---
addr: 8CDA0A
kind: code
category: 🧠
name: script_op_51_text
title: Script opcode 0x51 — text
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u16, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 48 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Show text in the default window ($034D): the string key, as 0x50.

Operands: `u16` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:9E03`; `$8C:CCF5` Look up a string by key in the string key table ($91:D000), pointer built from two immediates
- Opcode table entry: `$8C:E95F` (0x51)
