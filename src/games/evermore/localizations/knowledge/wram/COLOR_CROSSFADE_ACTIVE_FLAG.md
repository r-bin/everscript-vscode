---
addr: 7E150C
size: 2
kind: var
name: COLOR_CROSSFADE_ACTIVE_FLAG
title: Color palette cross-fade animation active execution flag
lifetime: room
confidence: confirmed
tags: [cgram, palette, crossfade, animation]
evidence: ["disasm: func_90D481 tests $150C bit 0; if set, steps cross-fade interpolation from colors at $D441 to $D461; clears bit 0 (AND #$FFFE) when current step $150E reaches target $1510"]
see: [knowledge/wram/65d1.md]
---
16-bit status flag controlling active palette cross-fading and smooth color gradient transitions (e.g. room lighting shifts, spell color pulses):
- **Bit 0 (`0x0001`)**: Active cross-fade state. Set when a color transition sequence begins.
- Monitored by `func_90D481` each frame to step intermediate color channel values in `$7E:65D1`. Cleared when the current progression counter (`$7E:150E`) equals target threshold (`$7E:1510`).
