---
addr: 7E24A3
size: 2
kind: var
name: TRANSIT_DEST_Y
title: Scripted lift / transit movement destination Y coordinate in world pixels
lifetime: room
confidence: confirmed
tags: [scripts, movement, lifts]
evidence: ["script: written by opcode 0x1B (write_tile_pair) in 68 occurrences", "script: Omnitopia lift script $9A:E24F and hub puzzle in room 0x48 use $24A1/$24A3 as destination coordinates (docs/credits-skip-candidates.md)", "script: teleport destinations in fire pits R54 and R58"]
see: [knowledge/wram/TRANSIT_DEST_X.md, knowledge/wram/TRANSIT_ORIGIN_X.md, knowledge/wram/TRANSIT_ORIGIN_Y.md]
---
Destination Y coordinate for scripted elevator platforms, moving platforms, and party transit sequences.
Paired with `$7E:24A1` (`TRANSIT_DEST_X`) as the arrival waypoint.
