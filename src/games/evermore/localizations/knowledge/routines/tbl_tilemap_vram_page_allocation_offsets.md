---
addr: 8C9720
end: 8C97AE
size: 143
kind: table
category: 📋
name: tbl_tilemap_vram_page_allocation_offsets
title: Background tilemap and VRAM page staging buffer offset pointer table
confidence: confirmed
tags: [tilemap, vram, staging, buffer, offsets, table]
evidence: ["disasm: 143 bytes at $8C:9720..$8C:97AE containing incremental $0400-stepped 16-bit word offset addresses for 32x32 BG tilemap page buffers preceding tbl_dog_evade_base"]
see: [rom/8c9700.md, rom/8c97af.md]
---
Tilemap staging buffer and VRAM page allocation offset table:
- Contains incremental 16-bit word addresses stepping by `0x0400` (1 KB per 32×32 BG tilemap page).
- Queried by screen scrolling and VRAM DMA upload routines to map viewport regions into staging buffers.

