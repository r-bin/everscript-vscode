---
addr: EC0400
end: EC38E1
size: 13538
kind: table
category: 🗺️
name: tbl_map_16x16_tile_pointers
title: Master map 16x16 graphics tile pointer directory
confidence: confirmed
tags: [map, graphics, chr, pointers, table]
evidence: ["binary data: 4,512 × 3-byte far pointers (low, mid, bank) addressing 16x16 map graphic tiles across ROM Banks $C0..$EF, bounding directly into map graphics at $EC:38E2 (out/recomp/asar/rom.bin:0x2C0400)"]
see: [src/games/evermore/localizations/knowledge/rom/9ffde7.md]
---
Master pointer directory for all 16×16 map graphical tiles:
- Contains 4,512 24-bit far pointers (13,538 bytes total) formatted as little-endian address triples (`[off_lo, off_hi, bank]`).
- Addresses compressed tile graphics patterns streamed by the map renderer to PPU VRAM during room load and scrolling transitions.
- Read by the tile loading and decompression pipeline at `$8C:C8A9` (`load_a_16_16_map_graphic_through_3_id`).
