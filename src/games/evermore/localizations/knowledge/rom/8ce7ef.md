---
addr: 8CE7EF
kind: code
category: 🧠
name: script_op_aa
title: Script opcode 0xaa
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands none, continues in the same turn (docs/game-research/script-vm/opcodes.md)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Only the operands and the flow are traced so far; what the handler does with them is not.

Operands: none (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$91:B9A7`
- Reads WRAM: `$7E:23C7` in Persistent RAM across rooms (names, story flags, markets, alchemy) (+$1C7)
- Writes WRAM: `$7E:23C7` in Persistent RAM across rooms (names, story flags, markets, alchemy) (+$1C7)
- Opcode table entry: `$8C:EA11` (0xaa)
