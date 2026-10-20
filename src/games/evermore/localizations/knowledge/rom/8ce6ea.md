---
addr: 8CE6EA
kind: code
category: 🧠
name: script_op_a9_attribute_bit
title: Script opcode 0xA9: set or clear an entity attribute
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands E E, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 32 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)", "disasm: JMP ($E6F8,x): $00-$0E -> $E730 (STA +$22), $10-$36 -> set/clear routines on +$10/+$12/+$14; the table ends at $E72E (v0.320.0)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Entity and an even selector, dispatched through the table at `$8C:E6F8`. `$00`-`$0E`: the facing `+$22` = the selector. `$10`/`$12` clear/set `+$10` bit `$4000` (set also clears pending damage `+$76` and `+$12` bits `$0478`), `$14`/`$16` set/clear `+$10` bit `$0002` (set also clears pending damage), `$18`/`$1A` clear/set `+$12` `$1000`, `$1C`/`$1E` set/clear `+$12` `$4000`, `$20`/`$22` set/clear `+$10` `$0400`, `$24`/`$26` set/clear `+$10` `$0080`, `$28`/`$2A` set/clear `+$12` `$C000`, `$2C`/`$2E` set/clear `+$14` `$0020`, `$30`/`$32` set/clear `+$14` `$0040`, `$34`/`$36` set/clear `+$14` `$0800`. Everscript `ATTRIBUTE_BITS` names some: `$12` temporary invincibility, `$14` invincible, `$1A` root, `$20` no clip, `$28` invisible. Selectors from `$38` jump through code bytes (garbage).

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Dispatches through: `$8C:E6F8`
- Opcode table entry: `$8C:EA0F` (0xa9)
