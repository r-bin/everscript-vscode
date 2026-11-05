---
addr: 90A1B4
size: 238
end: 90A2A1
kind: code
category: 🧠
name: map_anim_tile_channel_tick_and_vram_stream
title: Map Background Tile Animation Engine & Amortized VRAM Streamer
confidence: confirmed
tags: [graphics, ppu, map]
evidence: ["disasm: $90:A1B4 decrements delay timers across 50 channels ($7E:5018,X), advances frame indices ($7E:4FE6,X), and streams 128-byte 4bpp macro-tiles from Bank $EE into VRAM via DMA Channel 1 ($80:8650), throttled to 10 updates per frame", "recomp: reconstructed-c/90/90A1B4_map_anim_tile_channel_tick_and_vram_stream.c (G1 34/34, 526/526 fuzzed)"]
see: [routines/map_anim_tile_channel_search_or_activate.md, routines/vram_dma_upload_tile_block.md, maps/tile-animation.md, wram/7e4fe6.md, wram/7e5018.md, wram/7e504a.md]
---
Updates up to 50 environmental background animation channels (`$7E:106C` active count):
- Scans channels `X = 0..$106C-1`, skipping inactive slots (`$7E:504A,x == 0`) and decrementing countdown timers (`$7E:5018,x`).
- When a timer underflows (`$80..$FF`), advances keyframe index `$7E:4FE6,x` (wrapping to `0` at descriptor byte `[$A7],(x*4+1)`), resolves the 3-byte frame record at `[$A7],(x*4+2) + frame*3`, adds the frame delay to `$7E:5018,x` (`ADC $5018,x`), and decrements finite loop counts in `$7E:504A,x` (unless `$FF`).
- Computes the planar VRAM word address `DP $2E = (((x + $106E) << 5) & $00E0) | (((x + $106E) << 6) & $FE00)`.
- Resolves the 24-bit tile graphics pointer from `$EE:0000 + tile_id*3` (skipping the 1-byte header) into `DP $26..$28` and uploads both 64-byte halves (`DP $2E` and `DP $2E | $0100`) via `$80:8650` (`vram_dma_upload_tile_block`).
- Enforces an amortized budget of 10 tile uploads per frame (`DP $02`); once 10 channels have uploaded, remaining active channel timers (`$7E:5018,x`) still tick down at `$90:A273` without streaming.
- Deducts `updates * 12` (`((10 - $02) * 3) << 2`) from the per-frame VRAM budget at `DP $D8`, clamping negative results to `0`.
- Bound C implementation: `reconstructed-c/90/90A1B4_map_anim_tile_channel_tick_and_vram_stream.c`.
