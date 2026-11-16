---
addr: 90999C
end: 9099CD
size: 50
kind: code
category: 🧠
name: room_tilemap_layer2_parallax_offset_calc
title: Builds one tilemap row into VRAM DMA staging ring buffer and enqueues deferred transfer
confidence: confirmed
tags: [engine, tilemap, render, vram, dma, widescreen.streaming]
evidence: ["G1 differential testing against ROM and snes9x: 40/40 real states match 100%"]
---
Builds one tilemap row (top row, or the bottom row + 14 when scrolling vertically) of `$0FAC` cells into the 32-word ring buffer at `$2E` and queues it for deferred VRAM DMA via `sub_909A58` (VMAIN `$80`).

If `DP $0C == 0`, immediately returns without staging any transfer.
When scrolling, derives row offset using hardware multiplier `$4202` (`Y * map_width`), copies metatile word indices from `$7F:0000,x` dereferenced through `[$26],y`, and enqueues an 8-byte transfer record at `$013D`.
