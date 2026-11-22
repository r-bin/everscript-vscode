---
addr: 8CEF20
size: 10
end: 8CEF29
kind: code
category: 🧠
name: expression_boy
title: Expression sub-op $50 — the Boy
confidence: confirmed
tags: [script-vm, boy]
evidence: ["disasm: lda $0F3E; the value (high word 0); jmp $8C:EA49", "table: SCRIPT_EXPRESSION_SUBOP_TABLE word $50"]
see: [routines/SCRIPT_EXPRESSION_SUBOP_TABLE.md, docs/scripts/vm.md]
---
The Boy's entity (the word at `$0F3E`) as the current value. Scripts write it `boy`.
