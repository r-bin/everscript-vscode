---
addr: 908810
size: 29
end: 90882C
kind: code
category: 🎮
name: entity_trigger_action_animation_sequence
title: Validate and initiate entity attack / action animation sequence ($90:8810)
confidence: confirmed
evidence: ["disasm: calls validator $8F:B8F0; if carry clear, retrieves active entity slot from <$4C, triggers default action anim via $90:828E, and seeds bytecode PC <$5D..$5E from entity record +$00,Y", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.41): 12/12 states (12/12 oracle) and 189/189 fuzzed match ROM, mutation caught"]
see: ["routines/combat_weapon_charge_attack_hit_detection.md","routines/entity_start_default_action_anim.md"]
tags: ["entity","animation","action","combat"]
---
Entity action animation dispatcher. Calls validation hook `func_8FB8F0` (`$8F:B8F0`). If carry clear, retrieves active entity slot from `<$4C`, triggers action animation via `func_90828E` (`$90:828E`), and initializes script program counter `<$5D..$5E` from entity record `+$00,Y`.
