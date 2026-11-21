---
addr: 8F8710
end: 8F87FD
size: 238
kind: code
category: 🧠
name: field_hud_weapon_stamina_gauge_vram_dma_upload
title: Field HUD setup: tiles to BG3 $3E9, two palettes, the Boy and Dog widgets (column, row, gauge)
confidence: confirmed
tags: [hud, reconstructed-c, g1-pass]
evidence: ["disasm: the whole routine read 2026-11-21 (lda #imm : sta for every widget field; $2E = $1F48, $0008, $000C)", "G1 pass (4/4 reference states, 0/0 fuzzed states, mutation caught)"]
---
Sets up the field HUD (read 2026-11-21): uploads the 22 HUD tiles (`$C4:3704`, `$160` bytes) to VRAM word `$1F48`
(BG3 tiles `$3E9`-`$3FE`) and two palettes, `$C4:3864` to CGRAM 8 (BG3 palette 2, boxes and digits) and `$C4:386C`
to CGRAM 12 (palette 3, the gauge); then fills the two widgets (`$051D` Boy, `$0561` Dog): `+$00` the box's BG3
column (3, 19), `+$02` its row (25), `+$04` the popup node, `+$06` the gauge's VRAM address (`$1F00`, `$1F20`),
`+$08` the gauge's eight map words, `+$28` the HP string's seven; sets `$0B29` = 1.

## Callers
- `$8E:E08B` (`field_screen_ppu_layers_and_hud_vram_init`)

## Callees
- `$80:85FA` (`cgram_palette_dma_enqueue_or_immediate`)
- `$80:8650` (`vram_dma_upload_tile_block`)
