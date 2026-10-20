---
addr: AB
kind: opcode
title: Reset the game
confidence: confirmed
tags: ["opcode.flow"]
everscript: ["reboot()"]
evidence: ["disasm: handler at the table entry $8C:E8B1"]
see: ["rom/8ce8b1.md"]
---
Jumps to the reset code `$80:84C9`.

## Why it exists

Game over / end.
