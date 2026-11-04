---
addr: $7E:23F1
name: SCRIPT_CUTSCENE_WAYPOINTS
type: u16[8]
tags: [scripts, movement, cutscene]
confidence: verified
evidence: ["disasm", "cdl"]
---
Script VM Subsystem: Multi-point scripted cutscene walking waypoint coordinates array ($7E:23F1..$7E:2400, 8 words: 4 coordinate pairs X0/Y0, X1/Y1, X2/Y2, X3/Y3; written and evaluated by opcode 0x1B cutscene_walk_path across rooms 49, 4B, and 57).

