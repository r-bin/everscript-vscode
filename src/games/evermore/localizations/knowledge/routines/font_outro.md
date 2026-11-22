---
addr: C40C82
size: 3202
end: C41903
kind: table
category: 🧠
name: font_outro
title: The outro font: header, 128 glyphs, 128 widths
confidence: confirmed
tags: [ui, font, graphics, tables]
evidence: ["rom: the font table $8C:E6E6 holds $0000 and $0C82; opcode 0x9A font 2 picks the second (everscript FONT.OUTRO)", "rom: header $0C $02 like the default font, so the same layout: glyphs from $C4:0C84, widths from $C4:1884", "open-evermore: graphics/fonts/outro/glyphs/ read as the alphabet, thinner strokes"]
see: [routines/font_default.md, routines/font_metrics_table_setup.md]
---
The second font, the one `font 2` selects (the ending): the same layout as the default font. Open Evermore:
`graphics/fonts/outro/`.
