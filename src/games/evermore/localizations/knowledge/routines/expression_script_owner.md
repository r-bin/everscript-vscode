---
addr: 8CEF14
size: 12
end: 8CEF1F
kind: code
category: 🧠
name: expression_script_owner
title: Expression sub-op $2E — the script's own entity
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: ldx $7E (the script slot); lda +$0D,x; the value (high word 0); jmp $8C:EA49", "table: SCRIPT_EXPRESSION_SUBOP_TABLE word $2E"]
see: [routines/SCRIPT_EXPRESSION_SUBOP_TABLE.md, docs/scripts/vm.md]
---
The entity the running script belongs to (its slot's `+$0D`), as the current value. Scripts write it `script_owner`.
