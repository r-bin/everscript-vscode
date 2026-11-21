---
addr: 8CEF50
size: 215
end: 8CF026
kind: code
category: 🧠
name: expression_sub_ops_54_5b
title: Expression sub-ops $54-$5B — slot word, deref, camera, frame counter, shops
confidence: confirmed
tags: [script-vm]
evidence: ["table: SCRIPT_EXPRESSION_SUBOP_TABLE words $54-$5B point at $8C:EF50, $EF6D, $EF7C, $EF5C, $EF8E, $EF98, $EFA2, $EFE6", "disasm: each ends in jmp $8C:EA49 (the evaluator's next byte); docs/scripts/vm.md lists what each gives"]
see: [routines/SCRIPT_EXPRESSION_SUBOP_TABLE.md, docs/scripts/vm.md]
---
The handlers of sub-ops `$54` (the slot's word at `+$09`, `$EF50`), `$57` (camera on the Dog, `$EF5C`), `$55` / `$56`
(the word / byte at the current value, `$EF6D` / `$EF7C`), `$58` / `$59` (the frame counter's low / high word,
`$EF8E` / `$EF98`), `$5A` / `$5B` (the shop routines, `$EFA2` / `$EFE6`), in that order in the bank.
