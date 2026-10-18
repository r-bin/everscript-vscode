---
addr: 8CDC9A
kind: code
category: 🧠
name: script_op_a2_spawn_at
title: Script opcode 0xa2 — spawn at
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u16 u16 E E, continues in the same turn (docs/game-research/script-vm/opcodes.md)", "trace: the game ran 3 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)", "recomp: clean C in docs/disassembly/script-vm/opcode-spawning.md"]
see: [docs/game-research/script-vm/opcodes.md, rom/8cdd19.md, rom/8eb55a.md, rom/8fa933.md, rom/8fb094.md, rom/8fde98.md]
---
Spawns an enemy, NPC, or projectile using evaluated expression coordinates:
- Reads word `enemy_index` (index into `$8E:B55A` table: ENEMY id * 2).
- Resolves character record pointer from `$8E:B55A`.
- Reads word `arg2` (flags/state: bit 15 selects spawner/deferred vs immediate projectile).
- Evaluates expression 1 for X coordinate via `$8C:EA43`.
- Evaluates expression 2 for Y coordinate via `$8C:EA43`.
- Forwards to common spawn commit routine `$8C:DD19`.
- Full clean C decompilation: `docs/disassembly/script-vm/opcode-spawning.md`.

