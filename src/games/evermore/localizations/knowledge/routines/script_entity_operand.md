---
addr: 8CEC8E
size: 921
end: 8CF026
kind: code
category: 🧠
name: script_entity_operand
title: Script VM — read an entity operand
confidence: verified
tags: [entity, script, reconstructed-c, g1-pass]
evidence:
  - "[\"disasm: $8C:EC8E is JSL $8C:EA43 (evaluate an expression), STA $4C, TAY, RTL: the low word of the value becomes the entity address in DP $4C and Y (v0.369.0)\", \"disasm: 15 handlers in bank $8C call it for their first operand, among them $8C:E0B0 (animate) and $8C:DD60 (attach_script)\"]"
  - "Reconstructed in `reconstructed-c/8C/8CEC8E_entity_position.c` (SOE_BIND); passes Gate G1 differential verification (31/31 reference states, 319/319 fuzzed states, mutation caught: yes, 30 / 185 ROM/C instructions per call)."
see: [routines/script_eval_expression.md, docs/scripts/vm.md]
---
Evaluates one expression and keeps only its low word, in DP `$4C` and Y, as the address of an
entity record. The handlers of the opcodes that act on an entity read their first operand with it
(`script-vm/facts.ts` `ENTITY_FIRST`). The high word is dropped, so a `signed` read in that operand
cannot change anything: the script viewers mark it with a warning.
