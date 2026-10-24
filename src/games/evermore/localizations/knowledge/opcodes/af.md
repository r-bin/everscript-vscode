---
addr: AF
kind: opcode
title: Call a script with arguments
confidence: confirmed
tags: ["opcode.call"]
everscript: ["call (builtin, with arguments)"]
evidence: ["disasm: $8C:D3C6 evaluates counted arguments at $8C:D315, reads a 16-bit target PC and bank byte, then allocates and chains a child script slot"]
see: ["rom/8cd3c6.md", "docs/disassembly/script-vm/opcode-af-call-with-args.md"]
---
Count byte and that many expressions to `$0E80` (`$8C:D315`), then as `0x29`; the callee reads them as its arguments.

## Why it exists

Parameterised routines.
