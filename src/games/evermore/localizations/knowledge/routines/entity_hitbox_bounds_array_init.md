---
addr: 8F8CCB
size: 146
end: 8F8D5C
kind: code
category: 🧠
name: entity_hitbox_bounds_array_init
title: Initialize secondary entity hitbox bounds and collision array
confidence: confirmed
tags: [physics, collision, combat]
evidence: ["disasm: loads HUD/collision component pointer from +$8E,Y; clears 32-word hitbox buffer at +$04,X; populates active bounds array slots with min $FF00 and max $00FF; advances by 16 bytes per slot"]
see: [docs/disassembly/entities/enemy-spawn-matrix.md, routines/entity_collision_mesh_init.md, routines/enemy_facing_compass_resolve.md]
---
Initializes secondary hitbox extents and multi-part collision bounds for complex entities and bosses.
Zeroes coordinate descriptors and sets default negative and positive extent limits.
Full disassembly and clean C reconstruction: `docs/disassembly/entities/enemy-spawn-matrix.md`.
