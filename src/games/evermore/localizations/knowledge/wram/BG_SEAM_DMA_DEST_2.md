---
addr: 7E1640
size: 26
kind: struct
name: BG_SEAM_DMA_DEST_2
title: Dynamic sprite VRAM slot DMA transfer destination array
lifetime: frame
confidence: confirmed
tags: [vram, dma, sprites, vblank]
evidence: ["disasm: nmi_v_blank_handler ($C0:823A) reads $7E:1640..$7E:1658 to set VMADDL/VMADDH ($2116) during dynamic sprite tile DMA", "disasm: func_C096FE writes destination words to this table"]
see: [knowledge/wram/dynamic_vram_tiles_8x8.md, knowledge/wram/SPRITE_TILE_STAGING_BUF.md]
---
Table of 13 destination word addresses in SNES VRAM (`$7E:1640`..`$7E:1658`, 26 bytes) for dynamic sprite tile DMA transfers.

When `func_C096FE` or `obj_tile_allocate` stages new 4bpp sprite tiles in WRAM buffers (`$7E:6C91` and `$7E:72D1`), it populates this array with the corresponding VRAM tile word offsets. During the subsequent VBlank, `nmi_v_blank_handler` (`$C0:823A`) iterates through these entries to program the VRAM address registers (`$2116`/`$2117`) and execute the tile transfers.

