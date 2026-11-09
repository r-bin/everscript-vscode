---
addr: 9098FA
size: 71
end: 909940
kind: code
category: 🧠
name: hud_compass_needle_update
title: BG1/BG2 tilemap streamer: queue the newly exposed metatile row and column
confidence: likely
tags: [hud, compass, map, render, widescreen, widescreen.streaming]
evidence: ["disasm: downsamples world X ($010E) and Y ($0110) via >> 4 into DP $46/$48; computes delta from previous centers $0F90/$0F8C; adds screen margin offset $0FAC; stores projected target to $0F92", "trace: executed when updating minimap blip and compass indicator"]
see: [docs/disassembly/ui/minimap-radar.md, routines/render_map_overlay_compass_hud.md, routines/hud_minimap_vram_blit.md]
---
Runs every field frame (from `$90:9876`). For BG1 and then BG2 it derives the metatile window from the scroll shadows (left = HOFS >> 4, top = (VOFS + 1) >> 4), compares it with the previous window (`$0F90`/`$0F8C`, `$0F98`/`$0F94`) and, when it moved by a cell, builds the new row (`$90:999C`, buffer `$097A`/`$09BA`, `$0FAC` cells) and the new column (`$90:99FB`, buffer `$08FA`/`$093A`, 15 cells) from the room grid `$7F:0000` and the metatile layer words, in VRAM ring order, and queues them on the VRAM DMA queue (`$013D`). Only the window the game shows (17 x 15 cells) is ever streamed. Previously believed: a compass/minimap needle update (asm read 2026-11-09).

