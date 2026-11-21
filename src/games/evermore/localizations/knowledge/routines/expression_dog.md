---
addr: 8CEF2A
size: 10
end: 8CEF33
kind: code
category: 🧠
name: expression_dog
title: Expression sub-op $51 — the Dog
confidence: confirmed
tags: [script-vm, dog]
evidence: ["disasm: lda $0F40; the value (high word 0); jmp $8C:EA49", "table: SCRIPT_EXPRESSION_SUBOP_TABLE word $51"]
see: [routines/SCRIPT_EXPRESSION_SUBOP_TABLE.md, docs/scripts/vm.md]
---
The Dog's entity (the word at `$0F40`) as the current value. Scripts write it `dog`.
