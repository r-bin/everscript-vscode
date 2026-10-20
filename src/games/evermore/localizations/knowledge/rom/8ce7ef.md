---
addr: 8CE7EF
kind: code
category: 🧠
name: script_op_aa_cure
title: Script opcode 0xAA: cure Boy and Dog
confidence: likely
tags: [script-vm]
evidence: ["disasm: if $23C7 is zero, calls $91:B9A7 with Y=$4E89 and then Y=$4F37, setting carry before each call; otherwise returns without either call", "disasm: $91:B9A7 walks the status slots at +$46/+$4C (empty = $FFFF); carry set jumps to $91:BA4D; evs: Everscript cure()"]
see: [docs/game-research/script-vm/README.md, docs/game-research/script-vm/opcodes.md]
---
Calls `$91:B9A7` for the Boy and for the Dog to clear their status effects (slots at `+$46`, `+$4C`, ...; `$FFFF` = empty). Carry is set for both calls, unless the one-shot `$23C7` is set: then it is cleared and the calls run with carry clear.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$91:B9A7`
- Reads WRAM: `$7E:23C7` in Persistent RAM across rooms (names, story flags, markets, alchemy) (+$1C7)
- Writes WRAM: `$7E:23C7` in Persistent RAM across rooms (names, story flags, markets, alchemy) (+$1C7)
- Opcode table entry: `$8C:EA11` (0xaa)
