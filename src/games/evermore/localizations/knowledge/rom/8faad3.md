---
addr: 8FAAD3
kind: code
category: 🗺️
name: entity_dispatch_direct_waypoint_movement
title: Entity direct/unconstrained waypoint navigation dispatcher ($8F:AAD3)
confidence: confirmed
evidence: ["disasm: clears collision layer DP $44; allocates waypoint node via $8F:98B5; configures coordinates via $8F:A7AA; sets path flags $0230 on node $3C12,X; raises moving flag bit $20 on entity +$10,Y and clears +$78,Y; caller: $8C:DAA6"]
see: [rom/8fa7aa.md]
tags: [waypoints, navigation, entities]
---
Dispatches an entity along an unconstrained or airborne waypoint route without collision checking. Clears elevation constraint `$44`, allocates a waypoint node via `$8F:98B5`, configures target coordinates via `$8F:A7AA`, sets path flags `$0230` in node word `$3C12,X`, and sets movement active flag `$0020` on entity status word `+$10,Y`.
