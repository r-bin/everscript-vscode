---
addr: 80AD62
size: 142
end: 80ADEF
kind: code
category: 🧠
name: random_below
title: Random number below n ($02), by a 16×16 multiply
confidence: confirmed
tags: [rng, combat]
evidence: ["disasm: calls the generator $80:859B, multiplies its 16-bit result by the word at DP $02 on the CPU multiplier $4202/$4203 and keeps the high word: rand16 · n >> 16 (v0.340.1)", "disasm: the damage roll $8F:C08C calls it with n = base + 1, so the roll is 0 … base", "stack: called from the damage roll, the generator entry sees $80:AD6B at S+1, the PHB byte at S+4 and $8F:C08F at S+5..S+7; Y is still the target (recomp combat RNG mod soe.debug.combat_rng, 2026-11-11)"]
see: [routines/random_number_generator.md, routines/physical_damage_into_pending_0x76.md, docs/disassembly/combat/random-below.md, reconstructed-c/80/8080AD62_random_below.c]
---
Returns a uniform random number from 0 to n − 1, where n is the word at direct page `$02`. Used by
the damage roll and other code that needs a bounded random value. The C reconstruction is in
`reconstructed-c/80/8080AD62_random_below.c`.
