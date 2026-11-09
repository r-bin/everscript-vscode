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
evidence: ["disasm: checks invulnerability/death flags in entity+$10 and entity+$14; sets hit reaction flags in entity+$12 (0x0438 / 0x0080), halves damage on flag 0x2000, clamps damage to 999, and accumulates into entity+$76 pending damage buffer", "c: G1 passed (tools/c-to-rom/g1.mts): the bound C equals the ROM on 3 entry states sampled from the 2:20 no-input reference and 47 fuzzed ones; snes9x agrees with the interpreter on 3; a mutation is caught"]
see: [routines/apply_spell_damage_to_targets.md, routines/entity_collision_check.md, reconstructed-c/8F/8FC0D3_dispatch_hit_reaction_and_knockback.c]
---
Called whenever an entity takes damage from an attack or spell:
- Sets invulnerability flash timer in `entity +0x14`.
- Triggers floating damage number display via `$8F:C09A`.
- Calculates knockback displacement vector directed away from the attacker's origin coordinate.
- Integrates velocity displacement into entity position registers while testing metatile collisions.
