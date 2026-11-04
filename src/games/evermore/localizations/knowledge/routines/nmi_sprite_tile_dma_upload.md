---
addr: 8082A1
size: 447
end: 80845F
kind: code
category: 🧠
name: nmi_sprite_tile_dma_upload
title: NMI 16x16 Sprite Tile Upload to VRAM
confidence: confirmed
tags: [entity, graphics, ppu, system]
evidence: ["disasm: $80:82A1 during VBLANK NMI streams 128-byte 16x16 CHR sprite blocks into VRAM: bytes 0-63 at the top row, 64-127 one OBJ row below"]
see: [routines/nmi_handler.md, routines/direct_sprite_draw_oam.md]
---
Part of the NMI VBLANK transfer pipeline:
- Uploads 128-byte 16×16 sprite graphic tiles into SNES VRAM OBJ character memory.
- Places bytes 0–63 on the upper row and bytes 64–127 one row below (top-left, top-right, bottom-left, bottom-right).
