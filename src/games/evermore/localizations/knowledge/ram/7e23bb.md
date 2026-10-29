---
addr: 7E23BB
size: 2
kind: var
name: TARGET_Y
title: Script waypoint / target position Y in world pixels
lifetime: room
confidence: confirmed
tags: [scripts, movement, party]
evidence: ["script: written by opcode 0x1B (write_tile_pair) in 30 room scripts alongside $23B9", "script: used by 18 rooms (68 occurrences) as target Y coordinate for walk_to() and teleport()", "script: paired with TARGET_X in Omnitopia room elevators, village teleports (R37), and vehicle drop cutscenes ($92:DD6E)"]
see: [ram/7e23b9.md, rom/8cd76b.md]
---
General-purpose target Y coordinate used by event scripts for positioning characters, NPCs, or vehicles.
Often set as a pair with `$7E:23B9` (`TARGET_X`) via opcode `0x1B` (`write_tile_pair`), then referenced by `walk_to()` or `teleport()` commands.
