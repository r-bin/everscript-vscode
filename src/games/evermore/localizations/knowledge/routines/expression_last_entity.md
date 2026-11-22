---
addr: 8CEC61
size: 19
end: 8CEC73
kind: code
category: 🧠
name: expression_last_entity
title: Expression sub-op $2D — the last entity
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: ldx $0341; the value is X (high word 0); entity +$3E set to 1 when it was 0; jmp $8C:EA49 (the evaluator's next byte)", "table: SCRIPT_EXPRESSION_SUBOP_TABLE word $2D"]
see: [routines/SCRIPT_EXPRESSION_SUBOP_TABLE.md, docs/scripts/vm.md]
---
The entity at `$0341`, the one a command last made or named, as the current value. On the way it sets that entity's
`+$3E` to 1 when it was 0. Scripts write it `last_entity` (Open Evermore: `scripts/entities/`).
