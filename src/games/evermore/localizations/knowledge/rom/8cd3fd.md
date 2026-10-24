---
addr: 8CD3FD
kind: code
category: 🧠
name: script_op_b4_start_thread_with_args
title: Script opcode 0xb4 — start thread with args
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands A u24, starts a parallel thread and continues (docs/scripts/opcodes.md)"]
see: [docs/scripts/opcodes.md, docs/disassembly/script-vm/opcode-b4-start-thread-with-args.md]
---
Handler of script opcode [0xB4](soe://rom/assets/scripts/opcodes/b4.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/b4.md`, served at `soe://rom/assets/scripts/opcodes/b4.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:CE86` Script VM — add a thread to the run list; `$8C:CF18` Script VM — allocate a slot for a script; `$8C:D315` Script VM — read call arguments
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$0D`, `+$3E`
- Opcode table entry: `$8C:EA25` (0xb4)

The independent-thread setup is documented in [opcode-b4-start-thread-with-args.md](../../../../../../docs/disassembly/script-vm/opcode-b4-start-thread-with-args.md) and modeled in `reconstructed-c/8C/8CD331_callback_dispatch.c`.
