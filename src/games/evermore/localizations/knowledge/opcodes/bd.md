---
addr: BD
kind: opcode
title: Unfreeze the Boy
confidence: confirmed
tags: ["opcode.actor_control"]
everscript: ["control()"]
evidence: ["disasm: handler at the table entry $8C:DAC5"]
see: ["rom/8cdac5.md"]
---
`0x2D` with mask 1: unfreezes the Boy (`$8F:CD4D`).
