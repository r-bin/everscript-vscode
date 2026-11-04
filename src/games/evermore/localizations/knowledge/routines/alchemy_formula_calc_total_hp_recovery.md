---
addr: 919DAF
size: 75
end: 919DF9
kind: code
category: 🎮
name: alchemy_formula_calc_total_hp_recovery
title: Commit HP healing across linked targets and accumulate total ($91:9DAF)
confidence: confirmed
evidence: ["disasm: traverses linked target list at +$2E,Y; executes entity_hp_heal_commit $8F:C09A on each target; accumulates total recovery into <$0C and stores into formula record +$2A,Y"]
see: ["routines/entity_hp_heal_commit.md"]
tags: ["alchemy","heal","hp","combat"]
---
Iterates through target entities linked at `+$2E,Y`. Summons HP heal commit for each target entity via `entity_hp_heal_commit` (`$8F:C09A`), accumulates total HP recovered into `<$0C`, and stores into formula total heal field `+$2A,Y`.
