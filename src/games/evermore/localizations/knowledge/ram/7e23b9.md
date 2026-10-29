---
addr: 7E23B9
size: 2
kind: var
name: TARGET_X
title: Script waypoint / target position X in world pixels
lifetime: room
confidence: confirmed
tags: [scripts, movement, party]
evidence: ["script: written by opcode 0x1B (write_tile_pair) in 30 room scripts alongside $23BB", "script: used by 22 rooms (84 occurrences) as target X coordinate for walk_to() and teleport()", "script: Omnitopia elevators (e.g. R0, R66, R68, R73) position boy at TARGET_X + 8 and dog at TARGET_X - 8"]
see: [ram/7e23bb.md, rom/8cd76b.md]
---
General-purpose target X coordinate used by event scripts for positioning characters, NPCs, or vehicles.
Often set as a pair with `$7E:23BB` (`TARGET_Y`) via opcode `0x1B` (`write_tile_pair`), then referenced by `walk_to()` or `teleport()` commands.
