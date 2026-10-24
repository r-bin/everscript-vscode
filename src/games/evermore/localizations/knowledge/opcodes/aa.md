---
addr: AA
kind: opcode
title: Cure Boy and Dog
confidence: confirmed
tags: ["opcode.combat"]
everscript: ["cure()","clear_status_effects()"]
evidence: ["disasm: $8C:E7EF branches directly to RTS when $7E:23C7 is nonzero; otherwise calls $91:B9A7 for Y=$4E89 and Y=$4F37 with carry set before each call and before return"]
see: ["rom/8ce7ef.md", "docs/disassembly/script-vm/opcode-aa-cure.md"]
---
If `$7E:23C7` is nonzero, the handler returns without calling `$91:B9A7` and without clearing the flag; carry is unchanged. If it is zero, the handler calls `$91:B9A7` for Y=`$4E89` and Y=`$4F37`, setting carry before each call and before returning. The purpose of `$23C7` is not established here.

## Why it exists

Inns, healers.
