---
addr: 9093AA
end: 90945F
size: 182
kind: code
category: 🧠
name: room_tilemap_camera_scroll_seam_update
title: BG2 visible tilemap window calculator and full-window VRAM upload ($90:93AA)
confidence: verified
tags: [camera, tilemap, rendering, widescreen, widescreen.streaming]
evidence: ["disasm: reads BG2 scroll ($0112/$0114) into viewport window $0F94..$0F9A, DMA-clears VRAM $0400, and uploads $0FAC columns x 15 rows from $7F:0000 (+2 word offset) with 32-column wrap via $90:93DF", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.39): 18/18 states (17/17 oracle) and 288/288 fuzzed match ROM, mutation caught"]
---

Computes the visible BG2 metatile bounds from PPU shadow scroll `$0112`/`$0114` into `$0F94`–`$0F9A`, clears the `$0400` VRAM nametable by fixed-source DMA from `$80:8000`, and streams `$0FAC` columns × 15 rows from bank `$7F` (metatile word `+2`) to `$2118`, wrapping at 32 columns.

## Widescreen notes

Read whole (2026-11-09): the **full-window** BG2 tilemap upload (BG1 `$90:9379` enters `$90:93DF` with VRAM base `0` and word offset `0`). Only this window is drawn; the rest of the VRAM ring stays blank.
