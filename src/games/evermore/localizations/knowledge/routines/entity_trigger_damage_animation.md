---
addr: 8FC2C4
size: 13
end: 8FC2D0
kind: code
category: 🧠
name: entity_trigger_damage_animation
title: Trigger Damage Hit Reaction Animation
confidence: confirmed
evidence: ["disasm: $8F:C2C4 loads character record offset +0x40 (damage animation ID) and starts the hit recoil animation track via $90:8124"]
see: [routines/entity_trigger_damage_reaction.md, routines/entity_process_damage_recoil.md, routines/dispatch_hit_reaction_and_knockback.md, docs/disassembly/combat/damage-reaction.md]
---
Dispatches entity hit reaction animation:
- Reads the `damage` animation descriptor from character record offset `+0x40`.
- Launches the hit recoil animation and sets the invulnerability timer upon taking damage.

