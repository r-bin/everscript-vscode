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
evidence: ["disasm: font_metrics_table_setup ($8C:9DAF) reads the header at $C4:0000+X: height $0C to $0B3D, byte columns $02 to $0B43; the stride height·columns ($0B3F) times $80 (an immediate) gives the width table at base + $C00 (DP $92)", "disasm: $8C:A938 lda.l $C40000,x with X = code - $20 + DP $92: the width; the rasterizer reads one byte a row (`lda.l $C40000,x` at $8C:A60C, `inx`, $0B3D times); $8C:AA0D/$AA21 put that same byte into both planes of a WRAM tile", "callers: X = 0 at $80:8CB9, $80:8D41, $8D:B4D5; opcode 0x9A font 0 through $8C:E6E6", "rom: the second 12 bytes of a glyph have ink only where its width is over 8 pixels (W, m, w, the hands $80/$81): drawn as the right column of a 16×12 glyph they complete it (2026-11-21; v0.453.0 read them as a shadow plane)"]
see: [routines/font_outro.md, routines/font_metrics_table_setup.md, routines/dialogue_glyph_render_char.md]
---
The font dialogue and menus write with, the one `font 0` selects: a header (12 rows a glyph, 2 byte columns), 128
glyphs for codes `$20`-`$9F` at 24 bytes each (16×12, 1bpp: the left 8 pixels' 12 rows, then the right 8 pixels'),
then 128 widths in pixels, how far the cursor steps. The shadow is the rasterizer's, not stored. Replaces the earlier entries that called the glyphs 95 × 32 bytes.
Open Evermore: `graphics/fonts/default/`.
