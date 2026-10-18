---
addr: 8CD3FD
kind: code
category: 🧠
name: script_op_b4_start_thread_with_args
title: Script opcode 0xb4 — start thread with args
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands A u24, starts a parallel thread and continues (docs/game-research/script-vm/opcodes.md)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Arguments, then as 0x07.

Operands: `A u24` (tokens: docs/game-research/script-vm/README.md). Flow: starts a parallel thread and continues.
