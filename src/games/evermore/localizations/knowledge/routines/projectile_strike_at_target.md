---
addr: 90DD2D
size: 43
end: 90DD57
kind: code
category: 🏹
name: projectile_strike_at_target
title: Projectile routine $08 — strike at the target point at once
confidence: confirmed
tags: [combat, projectile]
evidence: ["disasm: power +$28 → $0E9C, attack proc +$2A → $0E9A; DP $3E/$40 = the target point, $44 = $40; jsl $8F:B5F2 (strike_projectile_hit_test_melee_enters_at); entity +$10 cleared, the slot handed back to $0EC2", "rom: script-path selector (+$0A) of the record at $90:DB3E (projectile id 14), launched by opcode 0xB5"]
see: [routines/PROJECTILE_MOVEMENT_ROUTINES.md, routines/projectile_spawn_from_script_opcode_ce.md]
---
No flight: the projectile runs the hit test at the target point at once (DP `$44` = `$40`, likely the reach), with its own attack proc
and power, then frees its slot.
