---
addr: 8F9EA3
size: 32
end: 8F9EC2
kind: code
category: 🧠
name: companion_waypoint_raycast_probe
title: Validate direct line of sight between companion and target waypoint coordinate
confidence: verified
tags: [entities, companion, pathfinding, raycast, reconstructed-c, g1-pass]
evidence:
  - "[\"disasm: computes dy ($6A-$67) and dx ($69-$66), calculates 16-direction angle via $8F:AA51, calls line stepper $8F:9F05, and verifies elevation plane $44 matches target layer $6B\"]"
  - "Reconstructed in `reconstructed-c/8F/8F9EA3_companion_steering.c` (SOE_BIND); passes Gate G1 differential verification (42/42 reference states, 0/0 fuzzed states, mutation caught: yes, 543 / 9045 ROM/C instructions per call)."
see: [docs/disassembly/entities/companion-steering.md, routines/companion_metatile_raycast_line_stepper.md, routines/companion_neighbor_cell_collision_test.md]
---
Tests whether a clear, unobstructed straight-line trajectory exists between the companion's current
metatile and a historical breadcrumb waypoint:
- Calculates angular vector using `$8F:AA51`.
- Calls grid raycaster `$8F:9F05` to check each intermediate metatile for solid walls or impassable slopes.
- Verifies that target plane `$6B` matches the traversable layer `$44`.
Full disassembly and clean C reconstruction: `docs/disassembly/entities/companion-steering.md`.
