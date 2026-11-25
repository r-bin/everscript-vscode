---
addr: $7E:1462
name: BOY_IDLE_ANIMATION_RARE
type: u16
tags: ["boy", "animation", "weapons"]
confidence: verified
evidence: ["disasm: boy_load_weapon copies weapon record +$1C here ($8F:8231); $8F:CEBF starts it when the idle roll BOY_IDLE_ROLL is not negative (0: one roll in 16)", "corrected v0.470.0: was dog_sniff_target_y"]
see: ["wram/BOY_IDLE_ANIMATION.md", "wram/BOY_IDLE_ROLL.md"]
---
The Boy's second idle animation, played instead of `BOY_IDLE_ANIMATION` one time in 16. Every vanilla weapon gives the
same animation in both words (`+$1A` = `+$1C`), so the game never shows a difference; a hack can (`animations.idle_rare`).
