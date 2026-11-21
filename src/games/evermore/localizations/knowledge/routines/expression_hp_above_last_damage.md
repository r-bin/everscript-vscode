---
addr: 8CEC74
size: 26
end: 8CEC8D
kind: code
category: 🧠
name: expression_hp_above_last_damage
title: Expression sub-op $5C — 1 when the entity's HP exceed its last damage
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: Y = the current value (an entity); +$2A minus +$76 with the carry clear; the value 0 when the difference is not positive, else 1; jmp $8C:EA49", "table: SCRIPT_EXPRESSION_SUBOP_TABLE word $5C"]
see: [routines/SCRIPT_EXPRESSION_SUBOP_TABLE.md, docs/scripts/vm.md]
---
On the entity in the current value: 1 when its HP (`+$2A`) are more than its last damage (`+$76`), else 0
(`hp_above_last_damage` in the script viewers).
