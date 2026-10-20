---
addr: BA
kind: opcode
title: Spawn an enemy or NPC (short)
confidence: confirmed
tags: ["opcode.spawn"]
everscript: ["add_enemy()"]
evidence: ["disasm: handler at the table entry $8C:DCD9"]
see: ["rom/8cdcd9.md"]
---
As `0x3C` with a byte ENEMY value (doubled by the handler) and state 0.

## Why it exists

The 4-byte form.
