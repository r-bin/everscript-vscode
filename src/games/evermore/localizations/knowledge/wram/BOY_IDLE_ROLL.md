---
addr: $7E:1466
name: BOY_IDLE_ROLL
type: u16
tags: ["boy", "animation", "rng"]
confidence: verified
evidence: ["disasm: $8F:CEAB draws (random | $FFF0) + 1 (-15..0) when BOY_IDLE_TIMER reaches 0; $8F:CEB9: negative → BOY_IDLE_ANIMATION, 0 → BOY_IDLE_ANIMATION_RARE", "corrected v0.470.0: was DOG_FORAGE_ALERT_ANIM_STEP"]
see: ["wram/BOY_IDLE_ANIMATION.md", "wram/BOY_IDLE_ANIMATION_RARE.md"]
---
Which idle animation the Boy plays: a roll of -15..0 drawn when `BOY_IDLE_TIMER` runs out; negative (15 in 16) plays
`BOY_IDLE_ANIMATION`, 0 plays `BOY_IDLE_ANIMATION_RARE`.
