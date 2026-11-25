---
addr: 908C67
size: 14
end: 908C74
kind: code
category: 🎮
name: animation_script_reset_dog_forage_timer
title: Reset the Boy's idle timer when the animated entity is the Boy ($90:8C67)
confidence: confirmed
evidence: ["disasm: checks if active entity Y is companion dog $4E89; if true, calls dog_forage_random_timer_reset $8F:B28D"]
see: ["routines/dog_forage_random_timer_reset.md"]
tags: ["dog","forage","timer","ai"]
---
If the animated entity is the Boy (`Y == $4E89`, his entity), reloads his idle timer (`BOY_IDLE_TIMER`, `$1464`) via
`dog_forage_random_timer_reset` (`$8F:B28D`), so an animation that runs does not count as standing still. Corrected
v0.470.0: `$4E89` is the Boy, not the Dog, and the timer is his idle animation's.
