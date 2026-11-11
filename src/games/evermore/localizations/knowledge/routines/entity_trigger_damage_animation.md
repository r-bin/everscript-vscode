---
addr: 8FC2C4
size: 13
end: 8FC2D0
kind: code
category: 🧠
name: entity_trigger_damage_animation
title: Trigger Damage Hit Reaction Animation
confidence: confirmed
tags: [combat, entity, script, rng, rng.combat]
evidence: ["disasm: $8F:C2C4 loads character record offset +0x40 (damage animation ID) and starts the hit recoil animation track via $90:8124", "disasm: JML $90:8124 with X = the record's +$40 word and Y = the target, after clearing +$78; so an animation start whose id equals the entity's record +$40 is a knockback start (recomp combat RNG mod soe.debug.combat_rng, 2026-11-11)"]
see: [routines/entity_trigger_damage_reaction.md, routines/entity_process_damage_recoil.md, routines/dispatch_hit_reaction_and_knockback.md, docs/disassembly/combat/damage-reaction.md]
---
Dispatches entity hit reaction animation:
- Reads the `damage` animation descriptor from character record offset `+0x40`.
- Clears `+$78` and starts that animation through `$90:8124` (X the id, Y the entity).

Previously believed: it "sets the invulnerability timer"; it only clears `+$78` (the latch timer).

