---
addr: 90837C
size: 48
end: 9083AB
kind: code
category: 🎮
name: animation_script_random_frame_duration
title: Calculate randomized animation frame duration using hardware multiplier ($90:837C)
confidence: confirmed
evidence: ["disasm: sets hardware multiplier $4202 to script operand; queries RNG via $80:859B; writes to multiplier $4203; adds product $4217 to frame duration +$05,Y; advances script PC <$5D", "disasm: the first operand byte is the range r (to $4202), the second the base b; the frame lasts b + (r · (rand & $FF) >> 8) ticks, so b … b + r − 1; the generator call at $90:8384 leaves return $90:8387, Y the entity (recomp combat RNG mod soe.debug.combat_rng, 2026-11-11)", "game: the knockback animations roll here: Wimpy Flower 40…79, Boy (Bone Crusher) 8…47 (recomp combat RNG mod soe.debug.combat_rng, 2026-11-11)", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.42): 2/2 states (2/2 oracle) match ROM, mutation caught"]
see: ["routines/random_number_generator.md"]
tags: ["animation", "timer", "multiplier", "rng", "script", "rng.combat", "reconstructed-c", "g1-pass"]
---
Evaluates variable frame duration in animation script. Sets hardware multiplier `$4202` to script operand, generates random number via `FUN_80859b` (`$80:859B`), writes to multiplier `$4203`, and adds product `$4217` to frame duration `+$05,Y`.

This is the animation command `hold_random r, b`: the operand pointer `[DP $5D]` points at `r`, then
`b`. A knockback's length is rolled here (docs/entities/combat.md §6, §10).
