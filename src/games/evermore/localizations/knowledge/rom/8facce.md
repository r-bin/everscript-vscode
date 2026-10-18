---
addr: 8FACCE
kind: code
category: 🗺️
name: scan_room_triggers
title: Scan room triggers against actor metatile coordinates
confidence: confirmed
tags: [maps, triggers]
evidence: ["disasm: divides pixel X and Y by 16 (LSR x4) and offsets by $0F86/$0F88; iterates over 6-byte entries (y1, x1, y2, x2, scriptId:2); checks y1 <= Y < y2 and x1 <= X < x2; saves interaction context to $2421-$2427; jumps to launch_trigger_script ($8C:CE5C)"]
see: [docs/disassembly/maps/trigger-scanner.md, rom/8cce5c.md]
---
Scans active room step-on and B-triggers against an actor's world coordinates.
Converts pixel coordinates to 16-pixel metatile cells (`>> 4`) with camera origin offsets, then
evaluates 6-byte bounding boxes `[y1, x1, y2, x2, scriptId]`. On collision match, records interaction
context into `$7E:2421`–`$7E:2427` and jumps to `launch_trigger_script` (`$8C:CE5C`).
Full disassembly and clean C reconstruction: `docs/disassembly/maps/trigger-scanner.md`.
