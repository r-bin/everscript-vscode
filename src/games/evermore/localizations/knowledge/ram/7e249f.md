---
addr: 7E249F
size: 2
kind: var
name: TRANSIT_ORIGIN_Y
title: Scripted lift / transit movement origin Y coordinate in world pixels
lifetime: room
confidence: confirmed
tags: [scripts, movement, lifts]
evidence: ["script: written by opcode 0x1B (write_tile_pair) in 98 occurrences", "script: used in 111 script sites across 10 rooms (top memory reference in unnamed inventory)", "script: Omnitopia lift script $9A:E24F and hub puzzle in room 0x48 use $249D-$24A3 as start and destination waypoints (docs/credits-skip-candidates.md)"]
see: [ram/7e249d.md, ram/7e24a1.md, ram/7e24a3.md]
---
Starting Y coordinate for scripted elevator platforms, moving platforms, and party transit sequences.
Paired with `$7E:249D` (`TRANSIT_ORIGIN_X`) as the origin point, moving toward `$7E:24A1`/`$7E:24A3` (`TRANSIT_DEST_X`/`Y`).
