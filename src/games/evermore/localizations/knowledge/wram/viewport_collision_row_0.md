---
addr: $7E:08FA
name: viewport_collision_row_0
type: u16[16]
tags: [widescreen, widescreen.streaming]
confidence: likely
evidence: ["cdl", "disasm"]
---
Viewport metatile collision row 0 (16 words: solidity, ledge, stairs, elevation).

## Widescreen notes

Not collision. `$7E:08FA..$7E:0939` (this row and row 1) is the BG1 **column** staging buffer of the tilemap streamer `$90:98FA` (`room_collision_word_fetch_at_pixel_coords`, `$2E = $08FA`): 32 tilemap words in VRAM ring order, filled with `$0F` (15) cells of the newly exposed metatile column, then queued for VRAM DMA with VMAIN `$81` (+32 per word). `$093A` = BG2 column, `$097A` = BG1 row, `$09BA` = BG2 row (each 64 bytes, VMAIN `$80`, `$0FAC` cells). Previously believed: viewport collision rows (asm read 2026-11-09).
