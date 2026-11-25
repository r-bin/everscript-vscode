---
addr: $7E:1460
name: BOY_IDLE_ANIMATION
type: u16
tags: ["boy", "animation", "weapons"]
confidence: verified
evidence: ["disasm: boy_load_weapon ($8F:81C9) copies weapon record +$1A here ($8F:822A); $8F:CE89 (player_human_control_boy) skips the idle when it is 0 and starts it ($8F:CEC5, anim_start_record) when the idle roll is negative", "disasm: $8F:931B (stamina_prime_and_weapon_slice_dispatch, while PACIFIED $23BF) sets both idle words to $3EAE with the unarmed stand, walk and run", "corrected v0.470.0: was dog_sniff_target_x; no Dog code reads it"]
see: ["wram/BOY_IDLE_ANIMATION_RARE.md", "wram/BOY_IDLE_TIMER.md", "routines/boy_load_weapon.md"]
---
The Boy's idle animation (an animation record in bank `$C4`): what he plays after standing still for 1200-3247 frames
(`BOY_IDLE_TIMER`), 15 times in 16 (`BOY_IDLE_ROLL`). 0: no idle (the four spears, the Bazooka's ammo). Loaded from the
equipped weapon's record (`+$1A`; Open Evermore `equipment/weapons/<weapon>.json` `animations.idle`); while the Boy is
pacified (towns) the unarmed idle `$3EAE` instead.
