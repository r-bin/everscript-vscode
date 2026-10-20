---
addr: AF
kind: opcode
title: Call a script with arguments
confidence: likely
tags: ["opcode.call"]
everscript: ["call (builtin, with arguments)"]
evidence: ["disasm: handler at the table entry $8C:D3C6"]
see: ["rom/8cd3c6.md"]
---
Count byte and expressions to `$0E80`, then as `0x29`.

## Why it exists

Parameterised routines.
