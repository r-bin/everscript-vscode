---
addr: 8FAD9F
kind: code
category: 🧠
name: dispatch_tile_drift_vector
title: Evaluate collision bit 13 and dispatch conveyor or diagonal stairs drift ($8F:AD9F)
confidence: confirmed
tags: [maps, collision, drift, stairs, conveyor, physics]
evidence: ["disasm: entry $8F:AD9F checks collision bit 13 (0x2000) of tile word at $003C,y; if set, masks low nibble (bits 3..0), doubles for word offset, and jumps through 16-entry dispatch table at $8F:AF28 to apply conveyor vectors (0x8..0xF) or stairway shears (0x1..0x2)", "c: docs/disassembly/maps/slope-collision.md"]
see: [rom/8fadb2.md, rom/909de8.md, rom/8fa914.md]
---
Dispatches forced movement impulses from metatiles flagged with Always-Walkable / Drift (bit 13 = `0x2000`):
- Tiles with bit 13 force tile passability geometry to `0x00` (open via `$90:9E73`).
- Reinterprets the low nibble (bits 3..0) as a 16-entry direction vector dispatched through table `$8F:AF28`.
- Handles conveyor belts (Omnitopia pipes, volcano slides, Ivor Tower conveyors: directions `0x8`..`0xF`).
- Handles diagonal 45-degree stairway shears (`0x1` and `0x2`), synchronizing vertical displacement $\Delta dy$ with horizontal velocity $dx$ along isometric stair ramps.
- Verifies proposed displacement against target collision cell via `$8FAF48` before committing.
