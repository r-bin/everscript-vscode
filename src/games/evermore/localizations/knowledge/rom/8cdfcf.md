---
addr: 8CDFCF
kind: code
category: 🧠
name: activate_background_tile_animation
title: Activate a background tile animation channel
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler reads a byte into DP $06 and two words into DP $0A/$0C, then calls $90:A2A2; that routine searches and activates a matching room tile-animation channel", "trace: the game ran 4 distinct instructions with this opcode (tests/script-vm/goldens.json)"]
see: [rom/90a2a2.md, docs/game-research/script-vm/README.md, docs/game-research/script-vm/opcodes.md]
---
Uses its byte operand as the tile-animation channel key and copies the following two words to DP `$0A` and `$0C`. It passes these values and the key in DP `$06` to `$90:A2A2`, which searches the current room's animation descriptors and activates the matching channel when found. The handler returns Carry Set, so the script continues in the same turn.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$90:A2A2`
- Opcode table entry: `$8C:E981` (0x62)
