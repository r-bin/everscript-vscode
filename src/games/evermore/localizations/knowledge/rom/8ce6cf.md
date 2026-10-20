---
addr: 8CE6CF
kind: code
category: 🧠
name: script_op_9a_font
title: Script opcode 0x9A: select the font
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: indexes paired data at $8C:E6E6 using E, passes the selected index to $8C:9DAF, which reads a record from bank $C4 and writes values to $0B3D/$0B3F/$0B43 and DP $92", "trace: the game ran 14 distinct instructions with this opcode (tests/script-vm/goldens.json)", "disasm: index -> word at $8C:E6E6 ($0000, $0C82) -> $8C:9DAF reads the font header at $C4:0000 + word (v0.320.0)"]
see: [docs/game-research/script-vm/README.md, docs/game-research/script-vm/opcodes.md]
---
Expression 0 or 2 indexes the 2-word table `$8C:E6E6` (`$0000`, `$0C82`); `$8C:9DAF` loads that font header from bank `$C4` (glyph height and width to `$0B3D`/`$0B43`, sizes to `$0B3F`, DP `$92`). Everscript `FONT.DEFAULT` = 0, `OUTRO` = 2. Larger values read code bytes as offsets.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8C:9DAF`
- Reads ROM: `$8C:E6E6`
- Opcode table entry: `$8C:E9F1` (0x9a)
