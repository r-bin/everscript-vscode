---
addr: 8FCD17
size: 54
end: 8FCD4C
kind: code
category: 🧠
name: enemy_ai_dispatcher
title: Enemy combat AI behavioral jump table dispatcher ($8F:CBE0)
confidence: confirmed
tags: [combat, enemy, ai, dispatcher]
evidence: ["disasm: loads character record from entity+$60, reads behavior word at $8E0003,X, indexes into jump table $8F:CBE0", "docs: docs/entities/ai-behaviours.md; C in reconstructed-c/8F/8FCD17_enemy_ai.c (rewritten v0.342.0)"]
see: [routines/ai_chase.md, routines/enemy_ai_check_aggro.md, routines/ai_stationary.md]
---
Dispatches enemy combat behavior every frame during active gameplay:
- Reads the character table offset from `entity +0x60`.
- Long-reads the 16-bit behavior word from ROM Bank `$8E` (`$8E0003,X`).
- Dispatches execution through the 15-entry jump table at `$8F:CBE0`.
- Diverts to scripted path interpreter (`$8F:D2DA`) if state bits `$0014,Y & $F000` are set.
