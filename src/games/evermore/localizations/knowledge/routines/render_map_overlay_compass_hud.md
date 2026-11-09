---
addr: 909876
size: 24
end: 90988D
kind: code
category: 🧠
name: render_map_overlay_compass_hud
title: Map overlay dispatcher, compass needle positioning, and minimap HUD tick
confidence: confirmed
tags: [render, map, compass, hud, widescreen, widescreen.camera, widescreen.streaming]
evidence: ["disasm: updates weather via $90:9E93; reads environment index from $7E:241F; dispatches layer renderer via jump table ($8E68,x); updates compass needle via $90:98FA; blits minimap tiles via $90:A4A6", "trace: executed every frame tick during field exploration"]
see: [docs/disassembly/ui/minimap-radar.md, routines/hud_compass_needle_update.md, routines/hud_minimap_vram_blit.md]
---
Top-level map overlay and navigation HUD tick engine. Dispatches weather particle updates via `$90:9E93`,
indexes the map layer renderer jump table at `$8E68,x` based on `$7E:241F`, calculates compass needle
rotation and positioning via `$90:98FA`, and commits updated radar tiles to VRAM via `$90:A4A6`.
Full disassembly and clean C reconstruction: `docs/disassembly/ui/minimap-radar.md`.

## Widescreen notes

Read 2026-11-09: calls the camera (`$90:9E93`), the camera-mode entry of `$90:8E68`, then the tilemap streamer `$90:98FA` and `$90:A4A6`. It is the field camera-and-scroll tick, not a map overlay.
