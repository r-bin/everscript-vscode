---
addr: 8FBA3B
end: 8FBAAE
size: 116
kind: code
category: 🧠
name: combat_evade_rating_and_invulnerability_check
title: Melee combat evade rating evaluation, target filtering, and invulnerability check
confidence: confirmed
tags: [combat, evade, accuracy, hit, invulnerability]
evidence: ["disasm: 116 bytes at $8F:BA3B..$8F:BAAE; compares target evade rating from archetype record against attacker hit rating, marks entity invulnerability flag in +$12,Y, precedes HIT_CHANCE_POINTERS_BY_EVADE ($8F:BAAF); returns via RTL"]
see: [rom/8fba06.md, rom/8fba1a.md, rom/8fbaaf.md]
---
Core combat evasion and target strike validity evaluator:
- Checks target entity slot `$0F42` to verify vulnerability status.
- Fetches target evasion rating from character record field `+$07` / `+$1F`.
- Sets evasion / deflection flag bit `0x0040` in entity state `+$12,Y` if the attack misses.
- Returns via `RTL` directly into `HIT_CHANCE_POINTERS_BY_EVADE` dispatcher.
