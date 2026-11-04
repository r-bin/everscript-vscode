---
addr: 8FC09A
size: 11
end: 8FC0A4
kind: code
category: 🧠
name: entity_hp_heal_commit
title: Apply HP restoration, flash palette effect, and update player HUD
confidence: confirmed
tags: [combat, healing, entity]
evidence: ["disasm: triggers green palette flash $7E80 via $90:D858; adds heal amount to current HP ($002A,y); clamps against max HP from $8E:000F,x; for player targets (Y >= $4E89) invokes $8F:9144 for HUD gauge refresh; clears hurt/poison interval ticker ($0076,y) and clears unconscious flag ($0012,y &= $FB87)", "trace: invoked by alchemy healing spells and consumable items"]
see: [docs/disassembly/combat/healing-spells.md, routines/spell_heal_clamp_to_max_hp_999.md, routines/dispatch_hit_reaction_and_knockback.md]
---
Commits HP healing to target entity `Y`. Triggers a green screen/palette flash (ID `$7E80`) through
`$90:D858`, adds the heal amount to current HP at `$002A,y`, and clamps it against max HP from master
stat table `$8E:000F,x`. If the target is the Boy or Dog ($Y \ge 0x4E89$), it calls `$8F:9144` to update
the on-screen HUD health meters. Finally, zeroes the affliction ticker at `$0076,y` and clears the
unconscious bit (`$0400`) in `$0012,y`.
Full disassembly and clean C reconstruction: `docs/disassembly/combat/healing-spells.md`.
