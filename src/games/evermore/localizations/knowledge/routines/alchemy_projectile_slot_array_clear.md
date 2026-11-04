---
addr: 90D7CB
size: 18
end: 90D7DC
kind: code
category: 🎮
name: alchemy_projectile_slot_array_clear
title: Clear active projectile slots and manager state ($90:D7CB)
confidence: confirmed
evidence: ["disasm: resets projectile manager word $0F34 = 0; loops 4 times clearing projectile record slots at $0ECA,X (X=$51 down by -$1B); callers: entity loop $8F:B1AC, $8F:B38E"]
see: ["routines/combat_hitbox_tables_and_collision_init.md","routines/entities_frame_tick_update.md"]
tags: ["alchemy","projectile","slot","clear"]
---
Resets projectile management state `$0F34 = 0` and clears 4 projectile slot records at `$0ECA,X` (X=$51 stepping by -$1B: $51, $36, $1B, $00).
