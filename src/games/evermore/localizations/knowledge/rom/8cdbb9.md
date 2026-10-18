---
addr: 8CDBB9
kind: code
category: 🧠
name: script_op_21_warp_in_room
title: Script opcode 0x21 — warp in room
confidence: likely
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u8 u8, ends the script (docs/game-research/script-vm/opcodes.md)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Like 0x20 after stopping the field ($80:85D8, $8C:CEE9, $8F:B38E); then stops the scripts ($8C:CE99) and ends this one.

Operands: `u8 u8` (tokens: docs/game-research/script-vm/README.md). Flow: ends the script.
