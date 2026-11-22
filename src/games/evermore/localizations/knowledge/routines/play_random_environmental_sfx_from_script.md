---
addr: 90894E
size: 54
end: 908983
kind: code
category: 🔊
name: play_random_environmental_sfx_from_script
title: Play random environmental sound effect from animation script ($90:894E)
confidence: confirmed
evidence: ["disasm: validates entity range $3DE5..$4FE5 and flags +$14,Y; reads SFX offset from [<$5D]; advances pointer; rolls RNG via $80:859B; if bitmask $C000 matched, plays sound from $8C:8362,X via $8C:82DC", "reconstructed-c: 100% differential parity in G1 (10 real states, 1 fuzzed state)"]
see: ["routines/random_number_generator.md","routines/play_sound_effect_direct.md"]
tags: ["audio", "sfx", "script", "rng", "reconstructed-c", "g1-pass"]
---
Plays environmental sound effects triggered from script bytecode. Validates entity range `$3DE5..$4FE5` and state flags `+$14,Y`. Reads sound effect index from script pointer `[<$5D]`, advances pointer, queries RNG (`$80:859B`), and with 75% probability (`BIT #$C000 != 0`) plays sound effect `$8C:8362,X` via `play_sound_effect_direct` (`$8C:82DC`).
Reconstructed C binding in `reconstructed-c/90/90894E_play_random_environmental_sfx_from_script.c` verified via G1 differential testing.
