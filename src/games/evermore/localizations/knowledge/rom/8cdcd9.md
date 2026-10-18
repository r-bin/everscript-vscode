---
addr: 8CDCD9
kind: code
category: 🧠
name: script_op_ba_spawn
title: Script opcode 0xba — spawn
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u8 u8 u8, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 57 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)", "recomp: clean C in docs/disassembly/script-vm/opcode-spawning.md"]
see: [docs/game-research/script-vm/opcodes.md, rom/8cdd19.md, rom/8eb55a.md, rom/8fa933.md, rom/8fb094.md, rom/8fde98.md]
---
Spawns an active entity / projectile at tile coordinates with default flags (0):
- Reads byte `enemy_id` from bytecode.
- Resolves character record pointer from `$8E:B55A` (offset `enemy_id * 2`).
- Clears argument 2 to 0 in `DP $08`.
- Reads byte `tile_x`, multiplies by 8 (`tile_x << 3`) into `DP $46`.
- Reads byte `tile_y`, multiplies by 8 (`tile_y << 3`) into `DP $48`.
- Forwards to `$8C:DD19` which calls `$8F:B094` (`projectile_spawn_master`) and records pointer in `$7E:0341`.
- Full clean C decompilation: `docs/disassembly/script-vm/opcode-spawning.md`.

