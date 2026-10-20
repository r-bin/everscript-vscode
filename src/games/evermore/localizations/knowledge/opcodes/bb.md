---
addr: BB
kind: opcode
title: Damage an entity without knockback
confidence: likely
tags: ["opcode.combat"]
everscript: ["damage(…, no_knockback)"]
evidence: ["disasm: handler at the table entry $8C:E467"]
see: ["rom/8ce467.md"]
---
Entity, amount; queued with `$8F:C16E`.

## Why it exists

Hits that should not push.
