---
addr: $7E:05B1
name: DIALOGUE_LINE_DECODE_BUF
type: u8[100]
tags: [dialogue, ui, text]
confidence: verified
evidence: ["cdl", "disasm"]
---
100-byte active dialogue and menu text line staging buffer ($7E:05B1..$7E:0614). Populated by dialogue_format_and_append_line ($8C:9E03) with rasterized character tile tokens, formatted integers, and line wrapped glyph strings before DMA transfer to the VRAM tilemap.
