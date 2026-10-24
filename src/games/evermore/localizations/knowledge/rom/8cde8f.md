---
addr: 8CDE8F
kind: code
category: 🧠
name: script_op_5a
title: Script opcode 0x5a
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler calls $8C:C5E2; that routine activates the cutscene pause guard, resets dialogue queue indices, and polls $0B79 while advancing field ticks through $8E:E41E", "evs: clear_subtext emits opcode 0x5a in in/core/[group] 02_functions/[group] 02_everscript_commands/06_strings.evs"]
see: [docs/scripts/opcodes.md, rom/8cc543.md, rom/8cc4f6.md]
---
Handler of script opcode [0x5A](soe://rom/assets/scripts/opcodes/5a.md). Calls `$8C:C5E2` to enable the cutscene pause guard, reset the subtitle queue/window, and tick field frames while `$7E:0B79` bit `$40` indicates text is still moving; returns carry set without yielding. Host-side model: `docs/disassembly/script-vm/opcode-5a-clear-subtext.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:C5E2`
- Opcode table entry: `$8C:E971` (0x5a)
