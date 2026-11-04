---
addr: $7E:3A7E
name: damage_popup_dog_node
type: DamagePopupNode
tags: [dog, combat, hud]
confidence: verified
evidence: ["cdl", "disasm: func_CF8A72 ($8F:8B52), func_CF87FE ($8F:888E)"]
---
Player 2 (Dog) floating combat damage numbers & status popup node (64 bytes: `$7E:3A7E`..`$7E:3ABD`).

| Offset | Size | Name | Description |
|---|---|---|---|
| +$00 | 2 | SCREEN_X | Screen horizontal position |
| +$02 | 2 | SCREEN_Y | Screen vertical position |
| +$04 | 2 | VELOCITY_Y | Vertical velocity / bounce phase |
| +$06 | 2 | LIFETIME_TICKS | Lifetime duration countdown ticks |
| +$08 | 2 | VALUE | 16-bit numerical damage or healing amount |
| +$0A | 2 | COLOR_ATTR | Color attribute word (red, green, or critical white) |
| +$0C | 2 | DIGIT_SPRITE_BASE | Digit sprite tile base offset |
