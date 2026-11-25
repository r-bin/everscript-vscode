---
addr: 8FB28D
size: 14
end: 8FB29A
kind: code
category: 🎮
name: dog_forage_random_timer_reset
title: Reload the Boy's idle timer with 1200-3247 frames ($8F:B28D)
confidence: verified
tags: [dog, ai, forage, sniff, timer, reconstructed-c, g1-pass, rng]
evidence: ["reconstructed-c/8F/8FB28D_dog_forage_random_timer_reset.c passes Gate G1 (3/3 reference states, 48/48 fuzzed, mutation caught)"]
see: [routines/random_number_generator.md, routines/combat_hitbox_tables_and_collision_init.md, routines/companion_dog_sniff_and_forage_timer_tick.md]
---
Generates a random interval between 1200 and 3247 frames (20 to 54 seconds at 60 fps) by querying PRNG (`$80:859B`), masking to 11 bits (`$07FF`), adding `$04B0` (1200), and saving the result into the Boy's idle timer `BOY_IDLE_TIMER` (`$1464`). The name is historical: no Dog code reads `$1464`
(corrected v0.470.0); `player_human_control_boy` calls it every frame and keeps the countdown only while the Boy stands, so
his idle animation (`BOY_IDLE_ANIMATION`) starts after 20-54 s without input.

## Callers
- `$8F:CD8D` (`player_human_control_boy`), `$90:8C6E` (`animation_script_reset_dog_forage_timer`)

## Callers
- `$8F:B1AC` (`combat_hitbox_tables_and_collision_init`)

## Callees
- `$80:859B` (`random_number_generator`)
