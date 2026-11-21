---
addr: C43704
size: 352
end: C43863
kind: data
category: 🎨
name: hud_gauge_tiles
title: Field HUD gauge tiles: digits, %, /, level marks (22 2bpp tiles)
confidence: confirmed
tags: [graphics, hud]
evidence: ["disasm: field_hud_weapon_stamina_gauge_vram_dma_upload ($8F:8710) uploads $160 bytes from $C4:3704 to VRAM $1F48 with vram_dma_upload_tile_block ($80:8650)", "open-evermore v0.453.0: rendered as 2bpp with hud_gauge_palette, the digits 0-9, %, / and the level marks 1-3 appear"]
see: [routines/hud_gauge_palette.md, routines/field_hud_weapon_stamina_gauge_vram_dma_upload.md]
---
The field HUD's gauge graphics. Was called equipment slot border tiles (a guess). Open Evermore:
`graphics/hud/gauge_tiles.png`.
