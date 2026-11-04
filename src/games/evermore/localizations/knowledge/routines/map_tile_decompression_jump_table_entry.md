---
addr: 8CCC62
size: 147
end: 8CCCF4
kind: code
category: 🎮
name: map_tile_decompression_jump_table_entry
title: Calculate dynamic unrolled map tile blitter entry point ($8C:CC62)
confidence: confirmed
evidence: ["disasm: computes unrolled jump address $CCF1 - (A*2); pushes return address; sets direct page to $2100 (PPU registers); executes RTS trampoline to commence VRAM streaming; callers: map graphics load $8C:C88C"]
see: ["routines/load_a_16_16_map_graphic_through_3_id_dma_to_vra.md"]
tags: ["graphics","vram","trampoline","ppu"]
---
Dynamically calculates jump destination into unrolled map tile blit routine `$8C:CCF1 - (A * 2)`. Pushes computed return address, sets direct page to `$2100` (SNES PPU register space), and executes `RTS` trampoline to commence high-speed VRAM streaming.
