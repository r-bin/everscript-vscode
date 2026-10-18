---
addr: 8CE8BD
size: 390
kind: table
category: 📋
name: SCRIPT_OPCODE_HANDLER_TABLE
title: Script opcode handler table
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: $8C:D0A6 doubles the opcode byte and calls JSR ($E8BD,x); 195 words (opcodes 0x00-0xC2), the words after that are code", "trace: every opcode the game ran went to the handler this table names (tests/script-vm/goldens.json)"]
see: [rom/8cd0a6.md, docs/game-research/script-vm/opcodes.md]
---
One word per script opcode, `0x00`-`0xC2`: the handler's address in bank `$8C`, used by the
dispatcher at `$8C:D0A6`. Unused opcodes point at the `STP` traps `$8C:E8B5`-`$E8BC`. `0xAB` points at
`$8C:E8B1`, which jumps to `$80:84C9` (the game resets). Opcodes `$C3` and up would index past the
table into code; scripts never use them.

Previously recorded without evidence (migrated from tables.js); now read from the dispatcher.
