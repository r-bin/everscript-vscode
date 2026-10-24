---
addr: BB
kind: opcode
title: Damage an entity without knockback
confidence: likely
tags: ["opcode.combat"]
everscript: ["damage(…, no_knockback)"]
evidence: ["disasm: handler at the table entry $8C:E467"]
see: ["rom/8ce467.md", "docs/disassembly/script-vm/opcode-bb-damage-no-knockback.md"]
---
Entity and amount; when its HP is not 0 and `+$10` bit `$1000` is clear, `$8F:C16E` adds the amount to pending damage (`+$76`, `+$12` |= `$0018`): damage without knockback. Later damage processing applies it and shows the number.

## Why it exists

Hits that should not push.
