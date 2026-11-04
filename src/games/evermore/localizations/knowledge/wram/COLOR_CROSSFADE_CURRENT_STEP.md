---
addr: 7E150E
size: 2
kind: var
name: COLOR_CROSSFADE_CURRENT_STEP
title: Palette cross-fade progress counter
lifetime: room
confidence: confirmed
tags: [cgram, palette, crossfade, animation]
evidence: ["disasm: func_90D481 compares $150E with target $1510; adds $1512 if lower (ADC), subtracts $1512 if higher (SBC); passes $150E in parameter $12 to RGB blend routine func_90D34C"]
see: [knowledge/wram/COLOR_CROSSFADE_ACTIVE_FLAG.md]
---
16-bit progress counter representing the current interpolation step between source palette (`$D441, X`) and destination palette (`$D461, X`).
- Incremented or decremented toward target threshold `$7E:1510` by step rate `$7E:1512` in `func_90D481`.
- Fed as interpolation parameter `<$0x12` into RGB blending routine `func_90D34C`.
