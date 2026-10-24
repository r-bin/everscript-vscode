---
addr: 8CDFCF
kind: code
category: 🧠
name: activate_background_tile_animation
title: Activate a background tile animation channel
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler reads a byte into DP $06 and two words into DP $0A/$0C, then calls $90:A2A2; that routine searches and activates a matching room tile-animation channel", "trace: the game ran 4 distinct instructions with this opcode (tests/script-vm/goldens.json)"]
see: [rom/90a2a2.md, docs/scripts/vm.md, docs/scripts/opcodes.md]
---
Handler of script opcode [0x62](soe://rom/assets/scripts/opcodes/62.md). Reads a channel-key byte and two words into DP `$06`, `$0A`, and `$0C`, calls `$90:A2A2` to locate and activate the room tile-animation channel, then returns carry set. Host-side model: `docs/disassembly/script-vm/opcode-62-tile-animate.md`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$90:A2A2`
- Opcode table entry: `$8C:E981` (0x62)
