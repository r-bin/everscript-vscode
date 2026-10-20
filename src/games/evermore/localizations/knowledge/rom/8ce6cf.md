---
addr: 8CE6CF
kind: code
category: 🧠
name: dispatch_c4_parameter_record
title: Dispatch a C4 parameter record
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: indexes paired data at $8C:E6E6 using E, passes the selected index to $8C:9DAF, which reads a record from bank $C4 and writes values to $0B3D/$0B3F/$0B43 and DP $92", "trace: the game ran 14 distinct instructions with this opcode (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/README.md, docs/game-research/script-vm/opcodes.md]
---
Evaluates an index, uses it to select a word offset from `$8C:E6E6`, and passes the resulting offset to `$8C:9DAF`. That routine reads a record in bank `$C4`, performs hardware multiply operations, and writes intermediate values to `$0B3D`, `$0B3F`, `$0B43`, and DP `$92`. The record's gameplay meaning is unresolved. Returns Carry Set.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8C:9DAF`
- Reads ROM: `$8C:E6E6`
- Opcode table entry: `$8C:E9F1` (0x9a)
