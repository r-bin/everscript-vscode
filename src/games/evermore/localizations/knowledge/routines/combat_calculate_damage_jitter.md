---
addr: 8FC07E
size: 28
end: 8FC099
kind: code
category: 🎮
name: combat_calculate_damage_jitter
title: Calculate randomized combat damage variance offset ($8F:C07E)
confidence: confirmed
evidence: ["disasm: clamps input damage to minimum 1; rolls random integer below A+1 via $80:AD62; computes variance scaled by 1.75 (ADC <$12; ASL; ADC <$12; LSR; LSR); callers: attack proc $8F:B73C"]
see: ["routines/random_below.md","routines/attack_proc_spell_burst.md"]
tags: ["combat","damage","math","rng"]
---
Computes randomized combat damage variance. Takes base damage in A (ensuring minimum of 1). Rolls random number below `A + 1` via `random_below` (`$80:AD62`), scales by 1.75 ($	imes 7 / 4$), and returns variance offset.
