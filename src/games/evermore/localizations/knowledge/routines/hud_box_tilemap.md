---
addr: 8F8000
size: 60
end: 8F803B
kind: data
category: 🎨
name: hud_box_tilemap
title: Field HUD box: 3 rows of 10 BG3 map words, drawn for the Boy and the Dog
confidence: confirmed
tags: [hud, graphics, ui]
evidence: ["disasm: field_hud_meters_refresh_and_reactivate ($8F:87FE) uploads $8F:8000, $8F:8014 and $8F:8028 (20 bytes each, vram_dma_upload_tile_block $80:8650) to VRAM $0B20, $0B40, $0B60 + the widget's column ($051D Boy, $0561 Dog): BG3 rows 25-27", "rom: $2BEA $2BE9×8 $6BEA / $2BEB $23FF×8 $6BEB / $ABEA $ABE9×8 $EBEA: corner, edge, side tiles ($3E9-$3EB, hud_gauge_tiles), palette 2, priority, flipped for the other corners; $23FF the empty tile in palette 0", "replaces entity_shadow_blob / particle_spark / dust_cloud CHR tile entries named from a CDL export (2026-11-21)"]
see: [routines/hud_gauge_tiles.md, routines/hud_box_palette.md, routines/field_hud_meters_refresh_and_reactivate.md, docs/disassembly/ui/field-hud.md]
---
The frame of the HUD's two boxes, one BG3 map word a cell: the top edge (the HP digits are written over its
row), the sides around an empty interior (the gauge goes there), the bottom edge. Open Evermore:
`graphics/hud/hud.json` `box`.
