---
addr: 90D7CB
size: 18
end: 90D7DC
kind: code
category: 🎮
name: alchemy_projectile_slot_array_clear
title: Clear active projectile slots and manager state ($90:D7CB)
confidence: verified
tags: [alchemy, projectile, slot, clear, reconstructed-c, g1-pass]
evidence: ["reconstructed-c/90/90D7CB_alchemy_projectile_slot_array_clear.c passes Gate G1 (9/9 reference states, 144/144 fuzzed, mutation caught)"]
see: [routines/combat_hitbox_tables_and_collision_init.md, routines/entities_frame_tick_update.md]
---
Resets projectile management word `$0F34 = 0` and clears the 4 projectile slot records at `$0ECA,X` (X=$51 down by -$1B: $51, $36, $1B, $00).
Leaves A = X = `$FFE5`, negative flag set, zero flag clear, carry clear.

## Callers
- `$8F:B1AC` (`combat_hitbox_tables_and_collision_init`)
- `$8F:B38E` (`entities_frame_tick_update`)
