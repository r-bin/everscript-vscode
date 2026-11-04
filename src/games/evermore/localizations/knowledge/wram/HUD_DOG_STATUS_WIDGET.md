---
addr: $7E:0561
name: HUD_DOG_STATUS_WIDGET
type: HudStatusWidget
tags: [dog, graphics, hud]
confidence: verified
evidence: ["cdl", "disasm: func_CF8710 initializes widget type $13, X position $19, VRAM dest $1F20, and digit tiles $0589..$0595", "disasm: func_CF9144 updates Dog HP bar and converts current HP to decimal digits"]
---
68-byte struct (`$7E:0561`..`$7E:05A4`) defining the on-screen status bar widget for the Dog companion:

| Offset | Size | Name | Description |
|---|---|---|---|
| +$00 | 2 | WIDGET_TYPE | Widget type identifier ($0013) |
| +$02 | 2 | SCREEN_X | Screen column X position ($0019) |
| +$04 | 2 | SCREEN_Y | Screen row Y position / line |
| +$06 | 2 | VRAM_DEST | VRAM destination tilemap word address ($1F20) |
| +$08 | 32 | METER_TILES | Dynamic Stamina / HP bar meter tile indices |
| +$28 | 14 | DIGIT_TILES | ASCII decimal digit tiles for numeric HP readout |
| +$36 | 14 | RESERVED | Internal layout padding buffer |
