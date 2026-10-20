---
addr: 8CDAD4
kind: code
category: 🧠
name: script_op_2d_unfreeze_mask
title: Script opcode 0x2D: unfreeze by mask
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u8, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "disasm: bits $08 slot entity, $01 Boy ($4E89), $02 Dog ($4F37), each $8F:CD4D (v0.320.0)"]
see: [docs/game-research/script-vm/opcodes.md]
---
One byte of bits: `$08` the thread's bound entity (`slot + $0D`), `$01` the Boy, `$02` the Dog; each selected one is unfrozen through `$8F:CD4D`. Opcodes `0xBD`, `0xBF`, `0xC1` enter at `$8C:DADB` with masks 1, 2, 3.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8F:CD4D`
- Record fields (indexed by X/Y: a slot, an entity, a window): `+$0D`
- Opcode table entry: `$8C:E917` (0x2d)
