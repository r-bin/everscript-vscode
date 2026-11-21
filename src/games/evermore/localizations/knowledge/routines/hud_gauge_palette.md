---
addr: C43864
size: 8
end: C4386B
kind: data
category: 🎨
name: hud_gauge_palette
title: Field HUD gauge palette (4 colours to CGRAM 8)
confidence: confirmed
tags: [graphics, hud, palette]
evidence: ["disasm: $8F:8726 loads $C4:3864, 8 bytes, to CGRAM 8 through cgram_palette_dma_enqueue_or_immediate ($80:85FA)"]
see: [routines/hud_gauge_tiles.md, routines/hud_gauge_palette_2.md]
---
Four colours of the HUD gauge tiles. Was called stat arrow tiles (a guess). Open Evermore: `graphics/hud/gauge_palette.json`.
