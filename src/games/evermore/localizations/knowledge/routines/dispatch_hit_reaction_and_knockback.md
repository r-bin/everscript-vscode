---
addr: 8FC0D3
size: 78
end: 8FC120
kind: code
category: 🧠
name: dispatch_hit_reaction_and_knockback
title: Dispatch victim hit reaction, invulnerability frames, and knockback vector displacement
confidence: confirmed
tags: [combat, damage, knockback, reaction]
evidence: ["disasm: sets 30-frame invulnerability timer in entity+$14, spawns floating number sprite via $8F:C09A, computes knockback velocity vector away from attacker", "recomp: clean C in docs/disassembly/combat/hitbox-intersections.md"]
see: [routines/apply_spell_damage_to_targets.md, routines/entity_collision_check.md]
---
Called whenever an entity takes damage from an attack or spell:
- Sets invulnerability flash timer in `entity +0x14`.
- Triggers floating damage number display via `$8F:C09A`.
- Calculates knockback displacement vector directed away from the attacker's origin coordinate.
- Integrates velocity displacement into entity position registers while testing metatile collisions.
