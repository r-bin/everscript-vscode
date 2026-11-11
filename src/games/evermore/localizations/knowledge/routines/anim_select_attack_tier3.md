---
addr: 908317
size: 67
end: 908359
kind: code
category: 🧠
name: anim_select_attack_tier3
title: Animation Attack Tier 3 Selector
confidence: verified
tags: [weapon, entity]
evidence: ["disasm: $90:8317 dispatches attack animation ID in A (returns on Z=1, consumes Bazooka ammo when A=$41CA or falls back to $3EEE, flips facing if $C4:0002,x bit $4000 set, tail-jumps to $90:811B)", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.39): 19/19 states and 156/156 fuzzed match ROM, mutation caught"]
see: [routines/anim_select_action_track.md, combat/weapon-charge.md]
---
Dispatches the selected attack animation ID (`A`) for entity `Y` (entered directly or by fallthrough from `select_attack_level_by_stamina` `$90:82D8`):
- Returns immediately when `Z` is set (`A == 0`).
- Consumes active Bazooka ammo at `$2345` when `A == $41CA` (falling back to unarmed `$3EEE` when empty).
- Swaps mirrored facing at `+$22,Y` via `$90:815B` if `$C4:0002,X` has bit `$4000`, then tail-jumps to `entity_set_flag_0040` (`$90:811B`).
