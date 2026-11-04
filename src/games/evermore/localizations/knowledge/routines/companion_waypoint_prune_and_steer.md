---
addr: 8F9C24
size: 182
end: 8F9CD9
kind: code
category: 🧠
name: companion_waypoint_prune_and_steer
title: Prune stale waypoints from navigation queue and update steering velocity
confidence: confirmed
tags: [entities, companion, navigation, steering, waypoint]
evidence: ["disasm: inspects navigation flags in $3C12,X (bit 9 direct override, bit 5 proximity latch), checks remaining nodes against tail in $3BFF,X, calculates angle via $8F:AA51, tests adjacent cell traversability via $8F:9EC3, and sets velocity"]
see: [docs/disassembly/entities/companion-breadcrumb-queue.md, routines/companion_breadcrumb_fifo_delete_node.md, routines/companion_neighbor_cell_collision_test.md]
---
Advances companion steering along the breadcrumb path:
- Verifies direct line of sight override (bit 9) and arrival proximity latch (bit 5) in `$7E:3C12,X`.
- If waypoints are exhausted, halts follower movement and raises arrival flag (bit 4).
- Computes vector angle to the next node using `$8F:AA51`, tests adjacent cell collision with `$8F:9EC3`, and steers velocity vectors.
Full disassembly and clean C reconstruction: `docs/disassembly/entities/companion-breadcrumb-queue.md`.
