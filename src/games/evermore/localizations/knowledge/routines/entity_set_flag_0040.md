---
addr: 90811B
end: 908123
size: 9
kind: code
category: 🧠
name: entity_set_flag_0040
title: Set bit $0040 in the entity flag word at +$10
confidence: verified
tags: ["entity","flags"]
evidence: ["disasm: full body read (3 instructions): word at +$10 of the record in Y |= $0040, falls into $90:8124", "disasm: callers include ai_retreat, select_attack_level_by_stamina and the spell handlers via $91:CEFE", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.39): 23/23 states match ROM, mutation caught"]
see: ["src/games/evermore/localizations/knowledge/routines/entity_reset_field78_and_raise_flag_0040.md"]
---
Raises bit $0040 of the word at +$10 of the entity record in Y. What that bit means is not known yet; both the AI (retreat, attack-level choice) and alchemy casts set it.
