---
addr: 909545
size: 28
end: 909560
kind: code
category: 🧠
name: camera_frustum_cull_test
title: Test a probe position against the room edge inset box
confidence: confirmed
tags: [camera, culling, render, widescreen, widescreen.collision, widescreen.room_bounds]
evidence: ["disasm: compares entity Y ($48) against frustum top $0F4A and bottom $0F4E; compares entity X ($46) against frustum left $0F48 and right $0F4C; returns carry set if inside frustum box, carry clear if culled", "trace: called before queueing sprite animations and floor shadows"]
see: [docs/disassembly/engine-core/viewport-culling.md, docs/disassembly/engine-core/camera-system.md, routines/camera_center_and_clamp.md, routines/entity_screen_tile_projection.md]
---
Carry set when DP `$46`/`$48` lies inside the room-edge box `$7E:0F48..$7E:0F4E` (14 px from the left/right walls, 7 px from top/bottom), set once per room by `$90:8F80`. Called only by `probe_metatile_collision` for phasing entities (`+$10` bit `$0400`). Previously believed: a camera frustum test (asm read 2026-11-09).

