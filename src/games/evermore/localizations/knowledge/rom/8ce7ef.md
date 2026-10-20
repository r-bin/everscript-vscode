---
addr: 8CE7EF
kind: code
category: 🧠
name: call_helper_for_boy_and_dog
title: Call a helper for Boy and Dog when enabled
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: if $23C7 is zero, calls $91:B9A7 with Y=$4E89 and then Y=$4F37, setting carry before each call; otherwise returns without either call"]
see: [docs/game-research/script-vm/README.md, docs/game-research/script-vm/opcodes.md]
---
With no operands, checks `$23C7`. If zero, calls `$91:B9A7` first with the Boy pointer (`Y=$4E89`) and then with the Dog pointer (`Y=$4F37`), setting Carry before each call; otherwise neither call runs. The handler establishes these calls but not their broader effect. Returns Carry Set.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$91:B9A7`
- Reads WRAM: `$7E:23C7` in Persistent RAM across rooms (names, story flags, markets, alchemy) (+$1C7)
- Writes WRAM: `$7E:23C7` in Persistent RAM across rooms (names, story flags, markets, alchemy) (+$1C7)
- Opcode table entry: `$8C:EA11` (0xaa)
