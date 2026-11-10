---
addr: 8FB1AC
size: 125
end: 8FB228
kind: code
category: ⚔️
name: combat_hitbox_tables_and_collision_init
title: Combat entity hitbox tables and collision grid reset ($8F:B1AC)
confidence: verified
tags: [combat, hitbox, collision, tables, reset, reconstructed-c, g1-pass]
evidence: ["reconstructed-c/8F/8FB1AC_combat_hitbox_tables_and_collision_init.c passes Gate G1 (3/3 reference states, 48/48 fuzzed, mutation caught)", "disasm: called by gameplay_session_subsystems_init ($80:8CC9); clears active combat projectile slot $1074; calls $90:D7CB and $90:DC21; marks entity hitbox bounds $3BC9,X = $FFFF and $3C14,X = $0000 across all combat slots (REA dossier 0x8fb1ac)"]
see: [routines/projectile_entity_slot_link_init.md, routines/sound_or_event_queue_init.md, routines/alchemy_projectile_slot_array_clear.md, routines/dog_forage_random_timer_reset.md]
---
Initializes and clears active combat collision structures, resetting entity hitbox bounding boxes, projectile slots, and attack registration arrays:
1. Sets Data Bank to `$7E`.
2. Calls projectile/alchemy/sound/forage reset routines (`$90:D7CB`, `$90:DC21`, `$8F:DF14`, `$8F:B28D`).
3. Clears combat registers (`$1074`, `$1070`, `$1072`, `$2533`, `$3DDF`, `$0EA2`, `$4E59`, `$4E0B`).
4. Initializes entity free list links for 29 entity slots at `$3DE5` (stride `$8E`).
5. Initializes 6 combat slot bounds entries at `$3BC9,X` / `$3C14,X` (stride `$59`).
6. Restores original Data Bank and exits with `A = $FFFF`, `X = $01BD`, `Y = 0`, `C=0`.
