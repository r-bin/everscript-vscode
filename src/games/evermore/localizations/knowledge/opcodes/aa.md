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
Calls `$91:B9A7` for the Boy and for the Dog to clear their status effects (slots at `+$46`, `+$4C`, ...; `$FFFF` = empty). Carry is set for both calls, unless the one-shot `$23C7` is set: then it is cleared and the calls run with carry clear.

## Why it exists

Inns, healers.
