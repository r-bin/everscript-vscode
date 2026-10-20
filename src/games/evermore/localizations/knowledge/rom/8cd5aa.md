---
addr: 8CD5AA
kind: code
category: 🧠
name: script_op_7e_currency_convert
title: Script opcode 0x7E: exchange money between currencies
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: four expressions; $4202/$4203 multiply each byte of $0AC6+src by the multiplier, $4204/$4206 divide by the divisor; quotient added to $0AC6+dst, remainder stored back to the source (v0.320.0)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Exchanges money. Expressions: divisor, source currency offset (0, 3, 6, 9 into the 3-byte amounts at `$0AC6`), multiplier, destination currency offset. The source amount times the multiplier is divided by the divisor with the SNES math registers, byte by byte; the quotient is added to the destination and the source keeps the remainder. Returns Carry Set.

Previously believed: a palette transfer through `$90:D34C` (that is opcode `0x97`).

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Reads WRAM: `$7E:0AC6`; `$7E:0AC7`; `$7E:0AC8`
- Writes WRAM: `$7E:0AC6`; `$7E:0AC8`
- Hardware registers: `$4202`, `$4204`, `$4206`, `$4214`, `$4216`
- Opcode table entry: `$8C:E9B9` (0x7e)
