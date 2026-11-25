---
addr: $7E:1464
name: BOY_IDLE_TIMER
type: u16
tags: ["boy", "animation", "timer"]
confidence: verified
evidence: ["disasm: player_human_control_boy ($8F:CD88) saves it in DP $10, then dog_forage_random_timer_reset ($8F:B28D) reloads it with 1200 + (random & $7FF); with no direction held $8F:CE91 writes back the saved value - 1, so it counts down only while the Boy stands", "disasm: reset also by combat_hitbox_tables_and_collision_init and animation_script_reset_dog_forage_timer ($90:8C67, for the Boy's entity $4E89)", "corrected v0.470.0: was DOG_FORAGE_COOLDOWN_TIMER"]
see: ["wram/BOY_IDLE_ANIMATION.md", "wram/BOY_IDLE_ROLL.md", "routines/dog_forage_random_timer_reset.md"]
---
Frames until the Boy plays his idle animation: 1200-3247 (20-54 s), reloaded on every frame he moves or acts, counted
down while he stands. At 0 a new `BOY_IDLE_ROLL` is drawn; below 0 the idle keeps playing.
