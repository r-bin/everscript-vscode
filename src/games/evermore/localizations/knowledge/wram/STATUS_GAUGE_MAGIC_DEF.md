---
addr: $7E:0D93
name: STATUS_GAUGE_MAGIC_DEF
type: StatusGaugeWidget
tags: [graphics, ui]
confidence: verified
evidence: ["cdl", "disasm: $8D:A85B"]
---
Magic defense stat bar gauge widget animation and coordinate record ($7E:0D93..$7E:0DAA, 24 bytes) in status menu.

| Offset | Size | Name | Description |
|---|---|---|---|
| +$00 | 2 | SCREEN_X | Screen column horizontal tile coordinate |
| +$02 | 2 | SCREEN_Y | Screen row vertical tile coordinate |
| +$04 | 2 | TILE_BASE | VRAM base tile pattern index |
| +$06 | 2 | CURRENT_VAL | Current rendered stat gauge fill value |
| +$08 | 2 | TARGET_VAL | Target animated stat value |
| +$0A | 2 | ANIM_TIMER | Fill animation step interpolation timer |
