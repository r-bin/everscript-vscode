---
addr: C40000
size: 3202
end: C40C81
kind: table
category: 🧠
name: font_default
title: The default font: header, 128 glyphs, 128 widths
confidence: confirmed
tags: [ui, font, graphics, tables]
evidence: ["disasm: font_metrics_table_setup ($8C:9DAF) reads the header at $C4:0000+X: height $0C to $0B3D, planes a row $02 to $0B43; the stride height·planes ($0B3F) times $80 (an immediate) gives the width table at base + $C00 (DP $92)", "disasm: $8C:A938 lda.l $C40000,x with X = code - $20 + DP $92: the width; $8C:AA0D/$AA21 read a row's two bytes, ink and shadow", "callers: X = 0 at $80:8CB9, $80:8D41, $8D:B4D5; opcode 0x9A font 0 through $8C:E6E6", "open-evermore v0.453.0: graphics/fonts/default/glyphs.png reads as the alphabet (8×12 glyphs, ink and shadow planes)"]
see: [routines/font_outro.md, routines/font_metrics_table_setup.md, routines/dialogue_glyph_render_char.md]
---
The font dialogue and menus write with, the one `font 0` selects: a header (12 rows a glyph, 2 bytes a row), 128
glyphs for codes `$20`-`$9F` at 24 bytes each (8 pixels wide; a row's first byte is the ink, its second the shadow),
then 128 widths in pixels, how far the cursor steps. Replaces the earlier entries that called the glyphs 95 × 32 bytes.
Open Evermore: `graphics/fonts/default/`.
