---
addr: $7E:0DAB
name: STATUS_GAUGE_EVADE
type: StatusGaugeWidget
tags: [combat, graphics, ui]
confidence: verified
evidence: ["cdl", "disasm: $8D:A85B"]
---
Evade stat bar gauge widget animation and coordinate record ($7E:0DAB..$7E:0DC2, 24 bytes) in status menu.

| Offset | Size | Name | Description |
|---|---|---|---|
| +$00 | 2 | SCREEN_X | Screen column horizontal tile coordinate |
| +$02 | 2 | SCREEN_Y | Screen row vertical tile coordinate |
| +$04 | 2 | TILE_BASE | VRAM base tile pattern index |
| +$06 | 2 | CURRENT_VAL | Current rendered stat gauge fill value |
| +$08 | 2 | TARGET_VAL | Target animated stat value |
| +$0A | 2 | ANIM_TIMER | Fill animation step interpolation timer |
