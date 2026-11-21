---
addr: C4386C
size: 8
end: C43873
kind: data
category: 🎨
name: hud_gauge_palette
title: Field HUD gauge palette (BG3 palette 3, CGRAM 12)
confidence: confirmed
tags: [graphics, hud, palette]
evidence: ["disasm: $8F:873C loads $C4:386C, 8 bytes, with $2E = $000C: CGRAM 12 through $80:85FA (2026-11-21; read as CGRAM 8 before)", "disasm: the gauge's eight map words (widget +$08, $8F:87AF) use palette 3"]
see: [routines/hud_box_palette.md, routines/hud_gauge_tiles.md]
---
Four colours of BG3 palette 3, the one the charge gauge's tiles are shown in. Open Evermore: `graphics/hud/hud.json`
`palettes.gauge`.
