---
addr: 8FB8F0
end: 8FB9F7
size: 264
kind: code
category: 🧠
name: combat_weapon_charge_attack_hit_detection
title: Performs spatial collision and radius checks for level 2 and 3 weapon charged swings
confidence: confirmed
tags: [combat, weapon, collision, sfx, reconstructed-c]
evidence: ["disasm: reads attacker slot in DP $4C; inspects active animation descriptor pointer in +$06,X and +$07,X; validates weapon shape 6; probes 4 corners against Bank $7F metatile collision grid; on collision plays SFX index $2C from $8C:8362 via $8C:82DC and returns CLC; on clear path returns SEC"]
see: [routines/combat_hitbox_bounds_overlap_test.md, reconstructed-c/8F/8FB8F0_combat_weapon_charge_attack_hit_detection.c]
---
Performs spatial collision and terrain obstruction checks for weapon charge attacks (shape 6):
- Reads active attacker entity slot from Direct Page register `$4C`.
- Inspects active animation record descriptor pointer in `+$06,X` and `+$07,X`.
- If shape type is not 6 (wide sweep), returns `SEC` immediately (unobstructed attack).
- Probes four bounding corners of the attack arc against the Bank `$7F` map metatile collision grid.
- If any corner collides with an obstacle, plays weapon rebound SFX (index `$2C` from table `$8C:8362` via `$8C:82DC`) and returns `CLC` (blocked attack).
- If all corners are clear, returns `SEC` (valid hit).
Clean C implementation: `reconstructed-c/8F/8FB8F0_combat_weapon_charge_attack_hit_detection.c`.
