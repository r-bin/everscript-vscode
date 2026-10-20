---
addr: BC
kind: opcode
title: Freeze the Boy
confidence: confirmed
tags: ["opcode.actor_control"]
everscript: ["control()"]
evidence: ["disasm: handler at the table entry $8C:DB1B"]
see: ["rom/8cdb1b.md"]
---
`0x2C` with mask 1: freezes the Boy (`$8F:CD78`).

## Why it exists

1-byte form.
