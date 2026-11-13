---
addr: 8CDC9A
size: 41
end: 8CDCC2
kind: code
category: 🧠
name: script_op_a2_spawn_at
title: Script opcode 0xa2 — spawn at
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u16 u16 E E, continues in the same turn (docs/scripts/opcodes.md)", "trace: the game ran 3 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)", "recomp: clean C in docs/disassembly/script-vm/opcode-spawning.md", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.43): 2/2 states (2/2 oracle) match ROM, mutation caught"]
see: [docs/scripts/opcodes.md, routines/script_spawn_commit.md, routines/enemy_index.md, routines/spawn_eval_tile_plane_elevation.md, routines/projectile_spawn_master.md, routines/spawn_stage_deferred_entity.md]
---
Handler of script opcode [0xA2](soe://rom/assets/scripts/opcodes/a2.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/a2.md`, served at `soe://rom/assets/scripts/opcodes/a2.md`.
