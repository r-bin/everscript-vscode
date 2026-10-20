---
addr: 8CD5AA
kind: code
category: 🧠
name: prepare_palette_transfer
title: Prepare a palette transfer
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler evaluates four expressions, uses $4202/$4204/$4206 and $4214/$4216 for arithmetic, stages data through $90:D34C, holds palette uploads via $0F3C, then calls $80:85FA to transfer palette data; exact expression roles are unresolved"]
see: [docs/game-research/script-vm/opcodes.md]
---
Evaluates four expressions and uses the SNES math registers to calculate values for a palette-data staging loop. The loop updates data through `$90:D34C` and `$7E:65F1`, increments/decrements the palette-upload hold at `$0F3C`, then calls `$80:85FA` to transfer palette data. The expression-to-field mapping and the exact arithmetic meaning remain unresolved. Returns Carry Set.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Reads WRAM: `$7E:0AC6`; `$7E:0AC7`; `$7E:0AC8`
- Writes WRAM: `$7E:0AC6`; `$7E:0AC8`
- Hardware registers: `$4202`, `$4204`, `$4206`, `$4214`, `$4216`
- Opcode table entry: `$8C:E9B9` (0x7e)
