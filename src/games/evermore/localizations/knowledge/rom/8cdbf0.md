---
addr: 8CDBF0
kind: code
category: 🧠
name: script_op_20_place_camera_tile
title: Script opcode 0x20 — place camera tile
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u8 u8, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 5 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)"]
see: [docs/game-research/script-vm/opcodes.md]
---
Two bytes times 8 to $46/$48 (x, y in pixels), then $8F:B434.

Operands: `u8 u8` (tokens: docs/game-research/script-vm/README.md). Flow: continues in the same turn.
