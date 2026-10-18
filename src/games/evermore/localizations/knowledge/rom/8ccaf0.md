---
addr: 8CCAF0
kind: code
category: 🧠
name: tile_decoder_op93_vram_transit
title: Opcode 0x93 tile decoder inter-pass VRAM address write
confidence: confirmed
tags: [maps, graphics, tiles, vram]
evidence: ["disasm: $8C:CAF0 STA VMADDL writes the offset VRAM address (bit 8 asserted) between pass 1 and pass 2 of tile opcode 0x93", "src/games/evermore/maps/render-trace-93.ts"]
see: [rom/8cca99.md, rom/8ccbe4.md]
---
Writes the adjusted VRAM word address to PPU register `$2116` (`VMADDL`) between pass 1 and pass 2 of tile graphics decompression opcode 0x93.
This switches to the upper tile bitplane row in VRAM before re-initializing the 32-word countdown counter for pass 2.

## Addresses
- PPU VRAM Address Low: `$2116` (`VMADDL`)
- Counter Re-init: `$8C:CAF6`
