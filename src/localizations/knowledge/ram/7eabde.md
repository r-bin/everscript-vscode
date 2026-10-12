---
addr: 7EABDE
end: 7EADFE
kind: buffer
name: OAM_MIRROR_BUFFER
title: SNES OAM mirror buffer (544 bytes)
lifetime: frame
confidence: confirmed
tags: [sprites, oam, ppu]
evidence: ["disasm: $80:9033 (direct_sprite_draw_oam) writes 544 bytes into $7E:ABDE, transferred to PPU OAM via DMA during V-blank"]
---
Main CPU mirror of SNES hardware OAM. Comprises 512 bytes of sprite attribute data (128 sprites x 4 bytes: X, Y, Tile, Attributes) followed by 32 bytes of upper X coordinate and size bits. Inverted/DMA-copied to $2104 during V-blank.

