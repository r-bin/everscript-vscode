---
addr: 8CEC8E
kind: code
category: 🧠
name: script_entity_operand
title: Script VM — read an entity operand
confidence: confirmed
evidence: ["disasm: $8C:EC8E is JSL $8C:EA43 (evaluate an expression), STA $4C, TAY, RTL: the low word of the value becomes the entity address in DP $4C and Y (v0.369.0)", "disasm: 15 handlers in bank $8C call it for their first operand, among them $8C:E0B0 (animate) and $8C:DD60 (attach_script)"]
see: [rom/8cea43.md, docs/scripts/vm.md]
---
Evaluates one expression and keeps only its low word, in DP `$4C` and Y, as the address of an
entity record. The handlers of the opcodes that act on an entity read their first operand with it
(`script-vm/facts.ts` `ENTITY_FIRST`). The high word is dropped, so a `signed` read in that operand
cannot change anything: the script viewers mark it with a warning.
