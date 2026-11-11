---
addr: 90828E
size: 74
end: 9082D7
kind: code
category: ⚔️
name: entity_start_default_action_anim
title: Entity default attack/action animation script launcher ($90:828E)
confidence: verified
evidence: ["disasm: loads entity pointer from DP $4C; reads monster type +$60,Y; looks up action animation script ref from table $8E:0032,X; jumps to anim_start_record ($90:8124); callers: enemy_ai_check_aggro ($8F:D69B), $8F:CC1E, $8F:D2DA, $8F:D94B", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.39): 39/39 states match ROM, mutation caught"]
see: [routines/anim_start_record.md]
tags: [ai, entities, animation, combat]
---
Starts the default combat attack or alert animation for entity `$4C`. Retrieves monster type `+$60,Y`, looks up its default action animation script reference from table `$8E:0032`, and jumps to `anim_start_record` (`$90:8124`).
