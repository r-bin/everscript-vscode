---
addr: 8CDCD9
size: 19
end: 8CDCEB
kind: code
category: 🧠
name: script_op_ba_spawn
title: Script opcode 0xba — spawn
confidence: confirmed
tags: [script-vm]
evidence: ["disasm: handler from the opcode table at $8C:E8BD; operands u8 u8 u8, continues in the same turn (docs/scripts/opcodes.md)", "trace: the game ran 57 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)", "recomp: clean C in docs/disassembly/script-vm/opcode-spawning.md", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.44): 30/30 states (30/30 oracle) match ROM, mutation caught"]
see: [docs/scripts/opcodes.md, routines/script_spawn_commit.md, routines/enemy_index.md, routines/spawn_eval_tile_plane_elevation.md, routines/projectile_spawn_master.md, routines/spawn_stage_deferred_entity.md]
---
Handler of script opcode [0xBA](soe://rom/assets/scripts/opcodes/ba.md). What it does, why it exists and how scripts use it: the opcode entry `knowledge/opcodes/ba.md`, served at `soe://rom/assets/scripts/opcodes/ba.md`.
