---
addr: 919E66
size: 38
end: 919E8B
kind: code
category: 🎮
name: alchemy_formula_apply_damage_to_target_list
title: Apply formula offensive damage across all linked target entities ($91:9E66)
confidence: confirmed
evidence: ["disasm: iterates target entity chain at +$2E,Y; toggles damage target flag +$14,Y; invokes damage application func_8FC0A5 $8F:C0A5; advances script PC +$14,Y by 2"]
see: ["routines/entity_hp_add_clamped.md"]
tags: ["alchemy","combat","damage","target"]
---
Applies formula damage across all linked target entities at `+$2E,Y`. Toggles damage target flag `+$14,Y`, triggers damage resolution via `func_8FC0A5` (`$8F:C0A5`), and advances script pointer `+$14,Y` by 2.
