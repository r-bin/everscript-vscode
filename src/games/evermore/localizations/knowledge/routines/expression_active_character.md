---
addr: 8CEF34
size: 10
end: 8CEF3D
kind: code
category: 🧠
name: expression_active_character
title: Expression sub-op $52 — the character the player controls
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: lda $0F42; the value (high word 0); jmp $8C:EA49", "table: SCRIPT_EXPRESSION_SUBOP_TABLE word $52"]
see: [routines/SCRIPT_EXPRESSION_SUBOP_TABLE.md, docs/scripts/vm.md]
---
The entity at `$0F42`, the character the player controls (the camera follows it), as the current value. Scripts
write it `active`.
