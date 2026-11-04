---
addr: 7E0F8C
end: 7E0F93
kind: struct
name: MINIMAP_RADAR_WINDOW_TOP
title: Minimap radar viewport window clipping bounds
lifetime: room
confidence: confirmed
tags: [minimap, radar, ui]
evidence: ["reconstructed-c: 90A4EC_minimap_projection.c clamps field metatiles against top ($0F8C), bottom ($0F8E), left ($0F90), right ($0F92)", "doc: docs/disassembly/ui/minimap-projection.md"]
see: [docs/disassembly/engine-core/wram-map.md]
---
8-byte 2D bounding window for on-screen radar/minimap metatile clipping:
- `$7E:0F8C` (2 bytes): Top window bound ($Y_{\text{min}}$).
- `$7E:0F8E` (2 bytes): Bottom window bound ($Y_{\text{max}}$).
- `$7E:0F90` (2 bytes): Left window bound ($X_{\text{min}}$).
- `$7E:0F92` (2 bytes): Right window bound ($X_{\text{max}}$).

In `func_90A4EC`, field metatiles projected onto the circular compass radar are tested against these bounds; tiles falling outside are clipped before merging with the dynamic palette mask (`$7E:0FB4`) and emitting into the VRAM staging buffer (`$7E:11F4`).

