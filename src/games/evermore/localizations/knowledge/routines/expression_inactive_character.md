---
addr: 8CEF3E
size: 18
end: 8CEF4F
kind: code
category: 🧠
name: expression_inactive_character
title: Expression sub-op $53 — the character the player does not control
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: lda $0F42; when not 0, eor #$4E89, eor #$4F37 (the Boy's and the Dog's entity swapped); the value (high word 0); jmp $8C:EA49", "table: SCRIPT_EXPRESSION_SUBOP_TABLE word $53"]
see: [routines/SCRIPT_EXPRESSION_SUBOP_TABLE.md, docs/scripts/vm.md]
---
The other character: `$0F42` with the Boy's entity (`$4E89`) and the Dog's (`$4F37`) swapped, 0 when `$0F42` is 0.
Scripts write it `inactive`.
