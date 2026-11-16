---
addr: 9099FB
end: 909A57
size: 93
kind: code
category: 🧠
name: room_collision_word_fetch_at_pixel_coords
title: Builds one tilemap column into VRAM DMA staging ring buffer and enqueues deferred transfer
confidence: confirmed
tags: [engine, tilemap, render, vram, dma, widescreen.streaming]
evidence: ["G1 differential testing against ROM and snes9x: 40/40 real states match 100%"]
---
Builds one tilemap column (left column, or right column = left + `$0FAC` − 1 when scrolling horizontally) of 15 cells into the 32-word ring buffer at `$2E` and queues it for deferred VRAM DMA via `sub_909A58` (VMAIN `$81`).

If `DP $0A == 0`, immediately returns without staging any transfer.
When scrolling, derives row-to-row stride stride offset via `$0F46`, copies metatile word indices from `$7F:0000,x` dereferenced through `[$26],y`, and enqueues an 8-byte transfer record at `$013D`.
