---
addr: 8CDE8F
kind: code
category: 🧠
name: script_op_5a
title: Script opcode 0x5a
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler calls $8C:C5E2; that routine activates the cutscene pause guard, resets dialogue queue indices, and polls $0B79 while advancing field ticks through $8E:E41E", "evs: clear_subtext emits opcode 0x5a in in/core/[group] 02_functions/[group] 02_everscript_commands/06_strings.evs"]
see: [docs/game-research/script-vm/opcodes.md, rom/8cc543.md, rom/8cc4f6.md]
---
Runs the cutscene dialogue reset/wait path through `$8C:C5E2`: it enables the cutscene pause guard, clears the active text window and queued dialogue indices, then services field ticks while polling text-state word `$0B79`. The exact meanings of the tested `$0B79` bits are not established here. The opcode itself returns Carry Set and does not yield the script thread.

Operands: none (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:C5E2`
- Opcode table entry: `$8C:E971` (0x5a)
