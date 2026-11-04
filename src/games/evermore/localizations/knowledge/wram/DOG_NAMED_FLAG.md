---
addr: 7E228B
size: 1
kind: var
name: DOG_NAMED_FLAG
title: Custom companion dog name initialization flag
lifetime: save
confidence: confirmed
tags: [companion, name, sram, init]
evidence: ["disasm: func_8EE124 checks $7E:228B bit 0; if 0, copies default Dog name from $8E:E3E9 to $7E:2234 using func_80B149", "disasm: func_8EE124 leaves $7E:2234 untouched if bit 0 is set"]
see: [knowledge/wram/2234.md]
---
Persistent save flag recording whether the companion dog has received a custom player-assigned name.
- Evaluated during SRAM initialization in `func_8EE124`:
  - If **Bit 0 (`0x01`)** is clear (`0`), the engine copies the default ROM dog name string from `$8E:E3E9` into `DOG_NAME_BUFFER` (`$7E:2234`).
  - If **Bit 0 (`0x01`)** is set (`1`), custom naming has taken place, preventing the default name from overwriting the save file name buffer.
