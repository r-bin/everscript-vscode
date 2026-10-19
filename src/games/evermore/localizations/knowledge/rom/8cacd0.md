---
addr: 8CACD0
end: 8CAD9D
kind: code
category: 🧠
name: window_tilemap_dma_commit
title: Synthesize window tilemap in shadow buffer and commit via DMA to VRAM
confidence: confirmed
tags: [ui, window, vram, dma]
evidence: ["disasm: calls $8C:AF2B to prepare border tiles; computes shadow offset via hardware multiply $4202/$4216; fills row words into $7F:C800; stages DMA transfer to VRAM word address (offset >> 1) + $0800 via $80:8650; loops over window height +$1E,Y with stride $0040"]
see: [docs/disassembly/ui/dialogue-box-frame.md, rom/8cac8a.md]
---
Synthesizes the window frame tilemap directly into shadow RAM at `$7F:C800`. Iterates over the window's
height in tiles, calculating line strides of 64 bytes (32 tiles per row), and triggers synchronous DMA
uploads to SNES VRAM at base word offset `+0x0800` via `$80:8650`.
Full disassembly and clean C reconstruction: `docs/disassembly/ui/dialogue-box-frame.md`.

