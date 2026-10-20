---
addr: AC
kind: opcode
title: Cast a spell (skip a dead Dog)
confidence: likely
tags: ["opcode.combat"]
everscript: ["cast()"]
evidence: ["disasm: handler at the table entry $8C:D0C3"]
see: ["rom/8cd0c3.md"]
---
As `0x9E`, but a Dog with 0 HP is left out of the targets (`$3BC1`).

## Why it exists

Spells aimed at the party.
