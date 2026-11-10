---
addr: 8FB28D
size: 14
end: 8FB29A
kind: code
category: 🎮
name: dog_forage_random_timer_reset
title: Dog forage / sniffing idle cooldown timer reset ($8F:B28D)
confidence: verified
tags: [dog, ai, forage, sniff, timer, reconstructed-c, g1-pass]
evidence: ["reconstructed-c/8F/8FB28D_dog_forage_random_timer_reset.c passes Gate G1 (3/3 reference states, 48/48 fuzzed, mutation caught)"]
see: [routines/random_number_generator.md, routines/combat_hitbox_tables_and_collision_init.md, routines/companion_dog_sniff_and_forage_timer_tick.md]
---
Generates a random interval between 1200 and 3247 frames (20 to 54 seconds at 60 fps) by querying PRNG (`$80:859B`), masking to 11 bits (`$07FF`), adding `$04B0` (1200), and saving the result into the companion dog's foraging cooldown timer `$1464` in WRAM.

## Callers
- `$8F:B1AC` (`combat_hitbox_tables_and_collision_init`)

## Callees
- `$80:859B` (`random_number_generator`)
