---
addr: DD
kind: opcode
title: Invalid opcode (past the handler table)
confidence: confirmed
tags: ["opcode.invalid","opcode.unused"]
evidence: ["disasm: $8C:D0A6 doubles the byte without a range check; the word at $8C:EA77 (code of the expression evaluator $8C:EA43) sends it to $8C:0285"]
see: ["rom/8cd0a6.md","rom/8cea43.md"]
---
The handler table ends at `0xC2`, and the dispatcher has no range check. For this byte it reads the word at `$8C:EA77`, which is code of the expression evaluator. That word sends the CPU to `$8C:0285`: low WRAM (the CPU would run whatever RAM holds). That is not a handler.

## Why it exists

It does not: the opcode space ends at `0xC2`.

## Notes

Cannot work: running it crashes or corrupts the game. Not used by the original scripts; the decoder reports it as an error.
