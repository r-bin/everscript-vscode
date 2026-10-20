---
addr: 8CE7EF
kind: code
category: 🧠
name: script_op_aa_cure
title: Script opcode 0xAA: cure Boy and Dog
confidence: likely
tags: [script-vm]
evidence: ["disasm: if $23C7 is zero, calls $91:B9A7 with Y=$4E89 and then Y=$4F37, setting carry before each call; otherwise returns without either call", "disasm: $91:B9A7 walks the status slots at +$46/+$4C (empty = $FFFF); carry set jumps to $91:BA4D; evs: Everscript cure()"]
see: [docs/scripts/vm.md, docs/scripts/opcodes.md]
---
Handler of script opcode [0xAA](soe://rom/assets/scripts/opcodes/aa.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/aa.md`, served at `soe://rom/assets/scripts/opcodes/aa.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$91:B9A7`
- Reads WRAM: `$7E:23C7` in Persistent RAM across rooms (names, story flags, markets, alchemy) (+$1C7)
- Writes WRAM: `$7E:23C7` in Persistent RAM across rooms (names, story flags, markets, alchemy) (+$1C7)
- Opcode table entry: `$8C:EA11` (0xaa)
