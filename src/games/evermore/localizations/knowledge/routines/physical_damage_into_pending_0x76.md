---
addr: 8FC067
size: 51
end: 8FC099
kind: code
category: 🧠
name: physical_damage_into_pending_0x76
title: Calculate net physical weapon damage
confidence: confirmed
tags: [combat, damage, accumulator]
evidence: ["disasm: evaluates attacker base power via $8F:C02B, subtracts target defense/4 (from $8E:001B,X with X = +$60,Y) clamped to at least 1; rolls random offset 0..base_damage via $80:AD62; returns net damage ((random + base) * 3) / 4 in A", "c: G1 passed (tools/c-to-rom/g1.mts): the bound C equals the ROM on 3 entry states sampled from the 2:20 no-input reference and 48 fuzzed ones; snes9x agrees with the interpreter on 3; a mutation is caught"]
see: [docs/disassembly/combat/to-hit-accuracy.md, reconstructed-c/8F/8FC067_physical_damage_into_pending_0x76.c, routines/attack_proc_melee_boy_kill_xp.md]
---
Calculates net physical weapon damage for an attack from attacker entity in DP `$4C` against target entity `Y`.
Fetches attacker base attack power via `$8F:C02B` and target defense from record `+$60,Y` in ROM table `$8E:001B`.
Base damage is `max(1, attack - target_defense / 4)`. A random variance offset in range `[0 .. base_damage]` is rolled via `$80:AD62`, returning final net damage `((random_offset + base_damage) * 3) / 4` in register `A`.
Host C model: `reconstructed-c/8F/8FC067_physical_damage_into_pending_0x76.c`.
