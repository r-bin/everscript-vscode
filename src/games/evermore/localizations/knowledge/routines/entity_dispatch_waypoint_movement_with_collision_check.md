---
addr: 8FAA82
size: 81
end: 8FAAD2
kind: code
category: 🗺️
name: entity_dispatch_waypoint_movement_with_collision_check
title: Entity waypoint navigation dispatcher with collision verification ($8F:AA82)
confidence: confirmed
evidence: ["disasm: checks destination terrain collision at DP $46/$48 via $90:9815; searches waypoint route via $8F:A93B; allocates waypoint node via $8F:98B5; sets coordinates via $8F:A7AA; raises moving flag bit $20 on entity +$10,Y and clears +$78,Y; if already at target, completes immediately via $8F:A8E2; caller: $8C:DAA6", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.43): 1/1 states (1/1 oracle) match ROM, mutation caught"]
see: [routines/tile_property_at_pixel_xy.md, routines/waypoint_set_target_coordinates.md, routines/entity_release_waypoint_node_and_signal.md]
tags: [waypoints, navigation, entities, collision]
---
Dispatches entity `Y` along a waypoint path toward target coordinates `$46`/`$48`. Checks target terrain collision via `tile_property_at_pixel_xy` (`$90:9815`), searches a navigation node via `$8F:A93B`, allocates a waypoint via `$8F:98B5`, configures coordinates via `waypoint_set_target_coordinates` (`$8F:A7AA`), and raises movement flag bit `$20` on entity status word `+$10,Y`. If entity is already at the destination, immediately terminates and signals caller via `entity_release_waypoint_node_and_signal` (`$8F:A8E2`).
