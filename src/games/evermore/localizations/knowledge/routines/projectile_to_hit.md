---
addr: 8FB9F8
size: 12
end: 8FBA03
kind: code
category: 🧠
name: projectile_to_hit
title: Projectile to-hit — record +$07 bit 4 makes the target immune
confidence: confirmed
tags: [combat, projectiles]
evidence: ["disasm: reads the target's record +$07; bit 4 set returns carry clear (no hit), otherwise falls through to the to-hit roll $8F:BA06 (v0.340.1)", "disasm: called only by the projectile handlers 2, 4 and 6 of $8F:B6AE ($8F:B6E0, $8F:B724, $8F:B73C)"]
see: [routines/melee_to_hit_roll.md, routines/g_attack_proc_table.md, routines/character_records.md]
---
A projectile's hit test. A character whose record has `+$07` bit 4 cannot be hit by projectiles at
all. In vanilla only record 135 has the bit.
