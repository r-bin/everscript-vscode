---
addr: C4386C
size: 8
end: C43873
kind: data
category: 🎨
name: hud_gauge_palette_2
title: Field HUD gauge palette, second load (4 colours to CGRAM 8)
confidence: confirmed
tags: [graphics, hud, palette]
evidence: ["disasm: $8F:873C loads $C4:386C, 8 bytes, to CGRAM 8 through $80:85FA, after hud_gauge_palette"]
see: [routines/hud_gauge_palette.md]
---
A second set of four colours for the same CGRAM slot. Open Evermore: `graphics/hud/gauge_palette_2.json`.
