---
addr: 909379
size: 49
end: 9093A9
kind: code
category: 🗺️
name: calc_visible_tilemap_bounds_from_scroll
title: Visible 16x16 tile column/row coordinate boundary calculator ($90:9379)
confidence: verified
evidence: ["disasm: reads camera X scroll $010E, masks #$0FF0 and shifts right 4 bits (LSR 4) to store leftmost column in DP $46 and $0F90; adds right margin $0FAC into $0F92; reads Y scroll $0110, masks #$0FF0 and shifts right 4 bits to store top row in DP $48 and $0F8C; adds bottom margin #$0F into $0F8E; branches to $90:93DF; caller: $90:94AB", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.39): 18/18 states (16/16 oracle) and 288/288 fuzzed match ROM, mutation caught"]
tags: [camera, tilemap, culling, rendering, widescreen, widescreen.streaming]
---
Calculates visible 16x16 tile grid boundaries from camera scroll registers. Shifts PPU X scroll `$010E` and Y scroll `$0110` right by 4 bits to compute leftmost column `$0F90` / `$46` and top row `$0F8C` / `$48`. Adds viewport span offsets to establish rightmost column `$0F92` and bottom row `$0F8E` for tilemap streaming and entity culling.

## Widescreen notes

Read whole (2026-11-09): sets the BG1 window (`$0F90`/`$0F92`, `$0F8C`/`$0F8E`) from BG1 scroll and branches into the full upload at `$90:93DF` with VRAM base 0 and metatile layer offset 0.
