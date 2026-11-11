---
addr: 8F857D
size: 131
end: 8F85FF
kind: code
category: 🧠
name: companion_stats_scaling_and_form_rebuild
title: Companion (Dog) level-based stat curves, passive charm amplification, and collar defense
confidence: verified
tags: [companion, dog, stats, level, charms, armor, reconstructed-c, g1-pass]
evidence: "[\"disasm: indexes Dog level from $7E:0A9A, queries Bank $8C stat tables (HP $8C:9515, MDef $8C:96D1, PDef $8C:95F3, Evade $8C:97AF, Hit $8C:90BF, Atk $8C:8FE1), checks charm bitfields $7E:2261..$7E:2263, adds gear bonuses, clamps HP to 999 and Atk/Hit to 99, and adds collar armor defense from $C4:0000\", \"trace: executed on Dog level up, collar equip, and charm acquisition\"]; G1 pass (17/17 reference states, 272/272 fuzzed states, mutation caught)"
see: [docs/disassembly/entities/companion-form-stats.md, routines/companion_toaster_form_transformation.md, routines/character_defense_and_buff_rebuild.md]
---
Recalculates all combat parameters for the Dog companion based on current level `$7E:0A9A`. Swaps stat curve lookups
between base and amplified tables in Bank `$8C` based on active alchemy charms (Chocobo Egg, Armor Polish, Atlas, Accuracy).
Integrates collar armor from `$C4:0000`, applies the $+25\%$ collar polish bonus, and enforces 999 Max HP and 99 stat limits.
Full disassembly and clean C reconstruction: `docs/disassembly/entities/companion-form-stats.md`.
