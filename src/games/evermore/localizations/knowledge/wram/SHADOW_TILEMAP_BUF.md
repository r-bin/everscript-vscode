---
addr: $7F:C800
name: SHADOW_TILEMAP_BUF
type: ShadowTilemapBuf
tags: [graphics, dialogue, hud, bank7f]
confidence: verified
evidence: ["disasm: 32x32 shadow tilemap RAM for dialogue windows, choice boxes, and HUD border 9-slice frames before VRAM DMA commit ($8C:CC43, $8C:CB64)", "docs/disassembly/ui/dialogue-choice-box.md", "docs/disassembly/ui/dialogue-box-frame.md", "reconstructed-c/8C/8CB647_dialogue_choice_box.c"]
---
32×32 shadow tilemap RAM for dialogue windows, choice boxes, and HUD border 9-slice frames before VRAM DMA commit ($8C:CC43, $8C:CB64, 4,096 bytes).

### Inner Struct Layout (`ShadowTilemapBuf`):
- `+$0000` (`row0_top_border`, `u16[32]` / 64 B): Row 0 dialogue/menu window top border frame tiles and title bar ($8C:B647).
- `+$0040` (`row1_text_line1`, `u16[32]` / 64 B): Row 1 dialogue message text line 1 ($8C:CC43).
- `+$0080` (`row2_text_line2`, `u16[32]` / 64 B): Row 2 dialogue message text line 2 ($8C:CC43).
- `+$00C0` (`row3_text_line3`, `u16[32]` / 64 B): Row 3 dialogue message text line 3 ($8C:CC43).
- `+$0100` (`row4_bottom_border`, `u16[32]` / 64 B): Row 4 dialogue window bottom border frame tiles ($8C:B647).
- `+$0140` (`choice_box_matrix`, `u16[352]` / 704 B): Rows 5..15 choice selection matrix, name entry grid, and shop item lists ($8C:B647, $8C:B81D, $8C:E17A).
- `+$0400` (`hud_frame`, `u16[384]` / 768 B): Rows 16..27 lower HUD status display, stamina gauge frames, Boy/Dog ring status ($8C:ACD0, $8D:91AF).
- `+$0700` (`secondary_overlay`, `u16[1024]` / 2,048 B): Secondary fullscreen 32×32 shadow overlay tilemap buffer ($8C:AFD0).
- `+$0F00` (`hdma_gradient_table`, `u8[256]` / 256 B): Vertical HDMA Channel 5 scanline brightness and color table staging buffer ($7F:D707..$7F:D70D, routine $91:C31F).
