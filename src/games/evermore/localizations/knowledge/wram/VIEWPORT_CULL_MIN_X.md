---
addr: 7E0F48
end: 7E0F4F
kind: struct
name: VIEWPORT_CULL_MIN_X
title: Room edge inset box for movement probes (not the camera)
lifetime: frame
confidence: confirmed
tags: [camera, render, culling, widescreen, widescreen.collision, widescreen.room_bounds]
evidence: ["reconstructed-c: 909545_viewport_culling.c defines ViewportFrustum at $7E:0F48..$7E:0F4E", "routine: func_909545 tests entity world X/Y against min_x ($0F48), min_y ($0F4A), max_x ($0F4C), max_y ($0F4E) before rendering contact shadows or queuing sprites", "disasm: only writer is $90:9046..$90:905C in room_header_reader_to: $0F48 = #$000E, $0F4A = #$0007, $0F4C = $08F2 - #$000E, $0F4E = $08F4 - #$0007 (asm read 2026-11-09)"]
see: [docs/disassembly/engine-core/wram-map.md]
---
8-byte box written once per room by `room_header_reader_to` ($90:8F80): min X = 14, min Y = 7, max X = room pixel width − 14, max Y = room pixel height − 7. It is the only writer. `camera_frustum_cull_test` ($90:9545) and `entity_screen_tile_projection` ($90:9561) test a probe position against it, so it keeps entities inside the room, not inside the screen. Previously believed: a camera viewport frustum updated every frame (asm read 2026-11-09).

Evaluated in `func_909545` (`camera_frustum_cull_test`): entities, NPCs, and contact shadow projections outside these bounds are discarded before performing VRAM buffer offset computations.

