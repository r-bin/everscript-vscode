---
addr: AB
kind: opcode
title: Reset the game
confidence: confirmed
tags: ["opcode.flow"]
everscript: ["reboot()"]
evidence: ["disasm: handler at the table entry $8C:E8B1"]
see: ["routines/script_op_ab_reset_game.md", "docs/disassembly/script-vm/opcode-ab-reset-game.md"]
---
Jumps to `$80:84C9`: screen off, interrupts off, stack reset, then the reset entry `$80:8034`.

## Why it exists

Game over / end.
