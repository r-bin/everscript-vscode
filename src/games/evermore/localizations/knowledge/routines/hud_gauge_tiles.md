---
addr: C43704
size: 352
end: C43863
kind: data
category: 🎨
name: hud_gauge_tiles
title: Field HUD tiles: box frame, digits, slash, level marks (22 2bpp tiles, BG3 $3E9-$3FE)
confidence: confirmed
tags: [graphics, hud]
evidence: ["disasm: field_hud_weapon_stamina_gauge_vram_dma_upload ($8F:8710) uploads $160 bytes from $C4:3704 to VRAM word $1F48 (BG3 tile $3E9) with vram_dma_upload_tile_block ($80:8650)", "open-evermore v0.453.0: rendered as 2bpp with hud_gauge_palette, the digits 0-9, %, / and the level marks 1-3 appear"]
see: [routines/hud_box_palette.md, routines/hud_box_tilemap.md, routines/field_hud_weapon_stamina_gauge_vram_dma_upload.md]
---
The field HUD's tiles, BG3 tiles `$3E9`-`$3FE`: the box's edge, corner and side, the digits 0-9 (`$3EC`-`$3F5`),
`$3F6` and `$3F7` (written by the charge gauge, `$8F:8AE4`), the slash (`$3F8`), and three 16×8 level marks split into
left (`$3F9`-`$3FB`) and right halves (`$3FC`-`$3FE`). Was called equipment slot border tiles (a guess). Open
Evermore: `graphics/hud/tiles/<name>.png`, one file a tile.
