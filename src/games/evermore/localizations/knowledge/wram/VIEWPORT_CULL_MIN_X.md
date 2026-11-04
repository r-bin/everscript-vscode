---
addr: 7E0F48
end: 7E0F4F
kind: struct
name: VIEWPORT_CULL_MIN_X
title: Camera viewport frustum bounding box for entity culling
lifetime: frame
confidence: confirmed
tags: [camera, render, culling]
evidence: ["reconstructed-c: 909545_viewport_culling.c defines ViewportFrustum at $7E:0F48..$7E:0F4E", "routine: func_909545 tests entity world X/Y against min_x ($0F48), min_y ($0F4A), max_x ($0F4C), max_y ($0F4E) before rendering contact shadows or queuing sprites"]
see: [docs/disassembly/engine-core/wram-map.md]
---
8-byte camera viewport frustum bounding box used for fast 2D spatial culling:
- `$7E:0F48` (2 bytes, signed 16-bit): Minimum world X coordinate (left frustum bound).
- `$7E:0F4A` (2 bytes, signed 16-bit): Minimum world Y coordinate (top frustum bound).
- `$7E:0F4C` (2 bytes, signed 16-bit): Maximum world X coordinate (right frustum bound).
- `$7E:0F4E` (2 bytes, signed 16-bit): Maximum world Y coordinate (bottom frustum bound).

Evaluated in `func_909545` (`camera_frustum_cull_test`): entities, NPCs, and contact shadow projections outside these bounds are discarded before performing VRAM buffer offset computations.

