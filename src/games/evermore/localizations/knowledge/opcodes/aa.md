---
addr: AA
kind: opcode
title: Cure Boy and Dog
confidence: likely
tags: ["opcode.combat"]
everscript: ["cure()","clear_status_effects()"]
evidence: ["disasm: handler at the table entry $8C:E7EF"]
see: ["rom/8ce7ef.md"]
---
`$91:B9A7` for Boy and Dog clears their status-effect slots (`+$46`...); `$23C7` (one-shot) picks the other mode.

## Why it exists

Inns, healers.
