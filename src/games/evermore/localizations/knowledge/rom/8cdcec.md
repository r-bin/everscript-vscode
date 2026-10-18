---
addr: 8CDCEC
kind: code
category: 🧠
name: script_op_3c_spawn
title: Script opcode 0x3c — spawn
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u16 u16 u8 u8, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 12 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)", "recomp: clean C in docs/disassembly/script-vm/opcode-spawning.md"]
see: [docs/game-research/script-vm/opcodes.md, rom/8cdd19.md, rom/8eb55a.md, rom/8fa933.md, rom/8fb094.md, rom/8fde98.md]
---
Places an enemy, NPC, or spawner entity using tile coordinates and explicit state flags:
- Reads word `enemy_index` (index into `$8E:B55A` table: ENEMY id * 2).
- Resolves character record pointer from `$8E:B55A`.
- Reads word `arg2` (flags/state: bit 15 selects spawner/deferred vs immediate projectile).
- Reads byte `tile_x`, multiplies by 8 (`tile_x << 3`) into `DP $46`.
- Reads byte `tile_y`, multiplies by 8 (`tile_y << 3`) into `DP $48`.
- Forwards to `$8C:DD19`:
  - If `arg2 & 0x8000`: invokes `$8F:DE98` (`spawn_stage_deferred_entity`).
  - If not `arg2 & 0x8000`: invokes `$8F:B094` (`projectile_spawn_master`) and writes entity pointer to `$7E:0341`.
- Full clean C decompilation: `docs/disassembly/script-vm/opcode-spawning.md`.

