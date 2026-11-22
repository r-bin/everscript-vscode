---
addr: C43864
size: 8
end: C4386B
kind: data
category: 🎨
name: hud_box_palette
title: Field HUD palette: boxes and HP digits (BG3 palette 2, CGRAM 8)
confidence: confirmed
tags: [graphics, hud, palette]
evidence: ["disasm: $8F:8726 loads $C4:3864, 8 bytes, to CGRAM 8 through cgram_palette_dma_enqueue_or_immediate ($80:85FA)"]
see: [routines/hud_gauge_tiles.md, routines/hud_gauge_palette.md, routines/hud_box_tilemap.md]
---
Four colours of the HUD's BG3 palette 2: the boxes (hud_box_tilemap) and the HP digits. Was called stat arrow tiles (a guess). Open Evermore: `graphics/hud/hud.json` `palettes.box`.
