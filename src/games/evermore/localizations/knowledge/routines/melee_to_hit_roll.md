---
addr: 8FBA06
size: 20
end: 8FBA19
kind: code
category: 🧠
name: melee_to_hit_roll
title: Melee to-hit roll — marks the target as struck by this attacker, then rolls
confidence: confirmed
tags: [combat, hit, strike]
evidence: ["disasm: $8F:BA06-$8F:BAAE: strike bookkeeping, evade-row lookup, adjusted hit-rate column, threshold compare and carry result", "disasm: $8F:BA97-$8F:BAA3: ($80:859B & $7FFF) < threshold returns carry set; zero threshold misses; $8F:BAA4-$8F:BAAE sets target +$12 bit $0040 and returns carry clear", "disasm: $8F:B75A calls $8F:BA06; $8F:B62B-$8F:B630 skips a target whose +$36 is the attacker", "routes: hit chances 58.8 % flower → Boy (hit 40, evade 34), 100 % against evade 0 (v0.335.0)"]
see: [routines/attack_proc_melee_boy_kill_xp.md, routines/HIT_CHANCE_POINTERS_BY_EVADE.md, routines/strike_sweep_filter.md]
---
`$8F:B75A` calls this routine for a candidate melee target. The callable entry is `$8F:BA06`;
`$8F:BA27` is the evade-row lookup within it, and control returns at `$8F:BAAE`. Before the roll,
the routine updates attacker/target fields `+$14`, `+$16`, `+$36`, and `+$38` as shown by the
instructions. The strike test `$8F:B61E` skips a target whose `+$36` is the attacker.

The routine chooses a row through `$8F:BAAF`, adjusts and quantizes the hit-rate value, then compares
`$80:859B & $7FFF` strictly below the selected word. A zero word misses without a roll. The strict
comparison means `$7FFF` is not mathematically certain: sample `$7FFF` misses. Full reconstruction
and assembly-derived bounds: `docs/disassembly/combat/projectile-homing.md`.
