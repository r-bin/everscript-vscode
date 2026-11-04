---
addr: $7F:A400
name: FONT_GLYPH_2BPP_BUF
type: FontGlyph2bppBuf
tags: [dialogue, graphics, bank7f]
confidence: verified
evidence: ["disasm: 2bpp font glyph proportional rasterization buffer and text tile blitter staging arena ($7E:0B41, $8C:A5AC, $8C:9E03)"]
---
2bpp font glyph proportional rasterization buffer and text tile blitter staging arena ($7E:0B41, $8C:A5AC, $8C:9E03, 3,072 bytes).

### Inner Struct Layout (`FontGlyph2bppBuf`):
- `+$0000` (`glyph_cells`, `u8[3072]` / 3,072 bytes): 32 proportional 2bpp font glyph rasterization tile cells (96 bytes per 16×16 glyph).
